import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '../../../../utils/rbac'
import {
  lockAssetBindingRowsForUpdate,
  lockAssetForUpdate,
  lockMachineForUpdate,
  readMachineStatus,
  refreshIotDeviceStatus,
  refreshMachineStatus
} from '../../../../utils/asset-lifecycle'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

const schema = z.object({
  machineId: z.string().min(1),
  reason: z.string().trim().min(2).max(120).default('portal-replace-machine')
})

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }

  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined
  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const body = schema.parse(await readBody(event))

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId

  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })
  }

  return prisma.$transaction(async (tx) => {
    await lockAssetForUpdate(tx, assetId)
    await lockMachineForUpdate(tx, body.machineId)
    await lockAssetBindingRowsForUpdate(tx, assetId, null, body.machineId)

    const [asset, newMachine] = await Promise.all([
      tx.asset.findFirst({
        where: {
          id: assetId,
          tenantId: resolvedTenantId,
          ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
          ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
        },
        select: { id: true, tenantId: true }
      }),
      tx.machine.findUnique({
        where: { id: body.machineId },
        select: { id: true, tenantId: true }
      })
    ])

    if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found in tenant scope' })
    if (!newMachine) throw createError({ statusCode: 404, statusMessage: 'Machine not found' })
    if (asset.tenantId !== newMachine.tenantId) throw createError({ statusCode: 409, statusMessage: 'Machine tenant mismatch' })

    const [currentActive, machineActiveOnAnotherAsset] = await Promise.all([
      tx.assetBinding.findFirst({
        where: {
          tenantId: asset.tenantId,
          assetId: asset.id,
          status: 'ACTIVE',
          endedAt: null
        },
        orderBy: { startedAt: 'desc' }
      }),
      tx.assetBinding.findFirst({
        where: {
          tenantId: asset.tenantId,
          machineId: newMachine.id,
          status: 'ACTIVE',
          endedAt: null,
          NOT: { assetId: asset.id }
        },
        select: { id: true }
      })
    ])

    if (machineActiveOnAnotherAsset) {
      throw createError({ statusCode: 409, statusMessage: 'Machine already bound to another asset' })
    }
    if (currentActive?.machineId === newMachine.id) {
      return { ok: true, changed: false, activeBindingId: currentActive.id }
    }

    const nextMachineStatus = await readMachineStatus(tx, newMachine.id)
    if (nextMachineStatus && !['NEW', 'SPARE'].includes(nextMachineStatus)) {
      throw createError({ statusCode: 409, statusMessage: `Only NEW or SPARE machine can be bound/replaced (current: ${nextMachineStatus})` })
    }

    const oldMachineId = currentActive?.machineId || null
    const oldIotDeviceId = currentActive?.iotDeviceId || null
    if (currentActive) {
      await tx.assetBinding.updateMany({
        where: {
          tenantId: asset.tenantId,
          assetId: asset.id,
          status: 'ACTIVE',
          endedAt: null
        },
        data: {
          status: 'INACTIVE',
          endedAt: new Date(),
          reason: body.reason,
          metadata: {
            action: 'replace-machine',
            replacedWithMachineId: newMachine.id
          }
        }
      })
    }

    const created = await tx.assetBinding.create({
      data: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        machineId: newMachine.id,
        iotDeviceId: currentActive?.iotDeviceId || null,
        reason: body.reason,
        metadata: {
          action: 'replace-machine',
          replacedFromMachineId: currentActive?.machineId || null
        }
      }
    })

    if (oldMachineId) {
      await tx.$executeRaw`
        UPDATE "machines"
        SET "status" = 'REPLACED'::"MachineStatus"
        WHERE "id" = ${oldMachineId}
      `
    }
    if (oldIotDeviceId) await refreshIotDeviceStatus(tx, oldIotDeviceId)
    await refreshMachineStatus(tx, newMachine.id)
    if (created.iotDeviceId) await refreshIotDeviceStatus(tx, created.iotDeviceId)

    return { ok: true, changed: true, activeBindingId: created.id }
  })
})
