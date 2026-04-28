import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import {
  lockAssetBindingRowsForUpdate,
  lockAssetForUpdate,
  lockMachineUnitForUpdate,
  readMachineUnitStatus,
  refreshIotDeviceStatus,
  refreshMachineUnitStatus
} from '../../../../utils/asset-lifecycle'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

const schema = z.object({
  machineUnitId: z.string().min(1),
  reason: z.string().trim().min(2).max(120).default('portal-replace-machine')
})

export default defineEventHandler(async (event) => {
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

  const resolvedTenantId = user.tenantId
    || (user.merchantAccountId
      ? (await prisma.merchantAccount.findUnique({
          where: { id: user.merchantAccountId },
          select: { tenantId: true }
        }))?.tenantId
      : null)

  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })
  }

  return prisma.$transaction(async (tx) => {
    await lockAssetForUpdate(tx, assetId)
    await lockMachineUnitForUpdate(tx, body.machineUnitId)
    await lockAssetBindingRowsForUpdate(tx, assetId, null, body.machineUnitId)

    const [asset, newMachineUnit] = await Promise.all([
      tx.asset.findFirst({
        where: { id: assetId, tenantId: resolvedTenantId },
        select: { id: true, tenantId: true }
      }),
      tx.machineUnit.findUnique({
        where: { id: body.machineUnitId },
        select: { id: true, tenantId: true }
      })
    ])

    if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found in tenant scope' })
    if (!newMachineUnit) throw createError({ statusCode: 404, statusMessage: 'Machine unit not found' })
    if (asset.tenantId !== newMachineUnit.tenantId) throw createError({ statusCode: 409, statusMessage: 'Machine unit tenant mismatch' })

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
          machineUnitId: newMachineUnit.id,
          status: 'ACTIVE',
          endedAt: null,
          NOT: { assetId: asset.id }
        },
        select: { id: true }
      })
    ])

    if (machineActiveOnAnotherAsset) {
      throw createError({ statusCode: 409, statusMessage: 'Machine unit already bound to another asset' })
    }
    if (currentActive?.machineUnitId === newMachineUnit.id) {
      return { ok: true, changed: false, activeBindingId: currentActive.id }
    }

    const nextMachineStatus = await readMachineUnitStatus(tx, newMachineUnit.id)
    if (nextMachineStatus && nextMachineStatus !== 'SPARE') {
      throw createError({ statusCode: 409, statusMessage: `Only SPARE machine unit can be bound/replaced (current: ${nextMachineStatus})` })
    }

    const oldMachineUnitId = currentActive?.machineUnitId || null
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
            replacedWithMachineUnitId: newMachineUnit.id
          }
        }
      })
    }

    const created = await tx.assetBinding.create({
      data: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        machineUnitId: newMachineUnit.id,
        iotDeviceId: currentActive?.iotDeviceId || null,
        reason: body.reason,
        metadata: {
          action: 'replace-machine',
          replacedFromMachineUnitId: currentActive?.machineUnitId || null
        }
      }
    })

    if (oldMachineUnitId) await refreshMachineUnitStatus(tx, oldMachineUnitId)
    if (oldIotDeviceId) await refreshIotDeviceStatus(tx, oldIotDeviceId)
    await refreshMachineUnitStatus(tx, newMachineUnit.id)
    if (created.iotDeviceId) await refreshIotDeviceStatus(tx, created.iotDeviceId)

    return { ok: true, changed: true, activeBindingId: created.id }
  })
})
