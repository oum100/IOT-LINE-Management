import { z } from 'zod'
import { prisma } from '#server/utils/prisma'
import { assertAdminAccess } from '#server/utils/admin-auth'
import {
  lockAssetBindingRowsForUpdate,
  lockAssetForUpdate,
  lockMachineForUpdate,
  refreshIotDeviceStatus,
  refreshMachineStatus
} from '#server/utils/asset-lifecycle'

const schema = z.object({
  reason: z.string().trim().min(2).max(120).optional().default('unbind-machine')
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }
  const body = schema.parse(await readBody(event))

  return prisma.$transaction(async (tx) => {
    await lockAssetForUpdate(tx, assetId)

    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: { id: true, tenantId: true }
    })
    if (!asset) {
      throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
    }

    const activeBinding = await tx.assetBinding.findFirst({
      where: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        status: 'ACTIVE',
        endedAt: null,
        machineId: { not: null }
      },
      orderBy: { startedAt: 'desc' }
    })
    if (!activeBinding?.machineId) {
      throw createError({ statusCode: 404, statusMessage: 'No active machine binding found' })
    }

    await lockMachineForUpdate(tx, activeBinding.machineId)
    await lockAssetBindingRowsForUpdate(tx, asset.id, null, activeBinding.machineId)

    const linkedOrder = await tx.orderItem.findFirst({
      where: { assetId: asset.id },
      select: { id: true }
    })
    if (linkedOrder) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Cannot unbind machine because this asset already has order history'
      })
    }

    await tx.assetBinding.updateMany({
      where: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        machineId: activeBinding.machineId,
        status: 'ACTIVE',
        endedAt: null
      },
      data: {
        status: 'INACTIVE',
        endedAt: new Date(),
        reason: body.reason,
        metadata: {
          action: 'unbind-machine',
          ...(activeBinding.metadata as Record<string, any> || {})
        }
      }
    })

    await refreshMachineStatus(tx, activeBinding.machineId)
    if (activeBinding.iotDeviceId) {
      await refreshIotDeviceStatus(tx, activeBinding.iotDeviceId)
    }

    return { ok: true, changed: true }
  })
})
