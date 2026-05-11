import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '../../../../utils/rbac'
import {
  lockAssetBindingRowsForUpdate,
  lockAssetForUpdate,
  lockDeviceForUpdate,
  readIotDeviceStatus,
  refreshIotDeviceStatus,
  refreshMachineStatus
} from '../../../../utils/asset-lifecycle'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

const schema = z.object({
  iotDeviceId: z.string().min(1),
  reason: z.string().trim().min(2).max(120).default('portal-replace-device')
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
    await lockDeviceForUpdate(tx, body.iotDeviceId)
    await lockAssetBindingRowsForUpdate(tx, assetId, body.iotDeviceId, null)

    const [asset, newDevice] = await Promise.all([
      tx.asset.findFirst({
        where: {
          id: assetId,
          tenantId: resolvedTenantId,
          ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
          ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
        },
        select: { id: true, tenantId: true }
      }),
      tx.iotDevice.findUnique({
        where: { id: body.iotDeviceId },
        select: { id: true, tenantId: true }
      })
    ])

    if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found in tenant scope' })
    if (!newDevice) throw createError({ statusCode: 404, statusMessage: 'IoT device not found' })
    if (asset.tenantId !== newDevice.tenantId) throw createError({ statusCode: 409, statusMessage: 'IoT device tenant mismatch' })

    const [currentActive, deviceActiveOnAnotherAsset] = await Promise.all([
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
          iotDeviceId: newDevice.id,
          status: 'ACTIVE',
          endedAt: null,
          NOT: { assetId: asset.id }
        },
        select: { id: true }
      })
    ])

    if (deviceActiveOnAnotherAsset) {
      throw createError({ statusCode: 409, statusMessage: 'IoT device already bound to another asset' })
    }
    if (currentActive?.iotDeviceId === newDevice.id) {
      return { ok: true, changed: false, activeBindingId: currentActive.id }
    }

    const nextDeviceStatus = await readIotDeviceStatus(tx, newDevice.id)
    if (nextDeviceStatus && !['NEW', 'SPARE'].includes(nextDeviceStatus)) {
      throw createError({ statusCode: 409, statusMessage: `Only NEW or SPARE IoT device can be bound/replaced (current: ${nextDeviceStatus})` })
    }

    const oldIotDeviceId = currentActive?.iotDeviceId || null
    const oldMachineId = currentActive?.machineId || null
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
            action: 'replace-device',
            replacedWithIotDeviceId: newDevice.id
          }
        }
      })
    }

    const created = await tx.assetBinding.create({
      data: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        machineId: currentActive?.machineId || null,
        iotDeviceId: newDevice.id,
        reason: body.reason,
        metadata: {
          action: 'replace-device',
          replacedFromIotDeviceId: currentActive?.iotDeviceId || null
        }
      }
    })

    if (oldIotDeviceId) {
      await tx.$executeRaw`
        UPDATE "iot_devices"
        SET "status" = 'REPLACED'::"IotDeviceStatus"
        WHERE "id" = ${oldIotDeviceId}
      `
    }
    if (oldMachineId) await refreshMachineStatus(tx, oldMachineId)
    await refreshIotDeviceStatus(tx, newDevice.id)
    if (created.machineId) await refreshMachineStatus(tx, created.machineId)

    return { ok: true, changed: true, activeBindingId: created.id }
  })
})
