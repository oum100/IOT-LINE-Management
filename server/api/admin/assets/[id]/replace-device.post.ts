import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import {
  lockAssetBindingRowsForUpdate,
  lockAssetForUpdate,
  lockDeviceForUpdate,
  readIotDeviceStatus,
  refreshIotDeviceStatus,
  refreshMachineUnitStatus
} from '../../../../utils/asset-lifecycle'

const schema = z.object({
  iotDeviceId: z.string().min(1),
  reason: z.string().trim().min(2).max(120).default('replace-device'),
  metadata: z.record(z.any()).optional()
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
    await lockDeviceForUpdate(tx, body.iotDeviceId)
    await lockAssetBindingRowsForUpdate(tx, assetId, body.iotDeviceId, null)

    const [asset, newDevice] = await Promise.all([
      tx.asset.findUnique({
        where: { id: assetId },
        select: { id: true, tenantId: true }
      }),
      tx.iotDevice.findUnique({
        where: { id: body.iotDeviceId },
        select: { id: true, tenantId: true }
      })
    ])

    if (!asset) {
      throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
    }
    if (!newDevice) {
      throw createError({ statusCode: 404, statusMessage: 'IoT device not found' })
    }
    if (asset.tenantId !== newDevice.tenantId) {
      throw createError({ statusCode: 409, statusMessage: 'IoT device tenant mismatch' })
    }

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
        select: { id: true, assetId: true }
      })
    ])

    if (deviceActiveOnAnotherAsset) {
      throw createError({ statusCode: 409, statusMessage: 'IoT device already bound to another asset' })
    }

    if (currentActive?.iotDeviceId === newDevice.id) {
      return {
        ok: true,
        changed: false,
        activeBindingId: currentActive.id
      }
    }

    const nextDeviceStatus = await readIotDeviceStatus(tx, newDevice.id)
    if (nextDeviceStatus && nextDeviceStatus !== 'SPARE') {
      throw createError({ statusCode: 409, statusMessage: `Only SPARE IoT device can be bound/replaced (current: ${nextDeviceStatus})` })
    }

    const oldIotDeviceId = currentActive?.iotDeviceId || null
    const oldMachineUnitId = currentActive?.machineUnitId || null
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
            replacedWithIotDeviceId: newDevice.id,
            ...(body.metadata || {})
          }
        }
      })
    }

    const created = await tx.assetBinding.create({
      data: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        machineUnitId: currentActive?.machineUnitId || null,
        iotDeviceId: newDevice.id,
        reason: body.reason,
        metadata: {
          action: 'replace-device',
          replacedFromIotDeviceId: currentActive?.iotDeviceId || null,
          ...(body.metadata || {})
        }
      }
    })

    if (oldIotDeviceId) {
      await refreshIotDeviceStatus(tx, oldIotDeviceId)
    }
    if (oldMachineUnitId) {
      await refreshMachineUnitStatus(tx, oldMachineUnitId)
    }
    await refreshIotDeviceStatus(tx, newDevice.id)
    if (created.machineUnitId) {
      await refreshMachineUnitStatus(tx, created.machineUnitId)
    }

    return {
      ok: true,
      changed: true,
      activeBindingId: created.id
    }
  })
})
