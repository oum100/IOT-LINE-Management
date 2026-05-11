import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import {
  lockAssetBindingRowsForUpdate,
  lockAssetForUpdate,
  lockMachineForUpdate,
  readMachineStatus,
  refreshIotDeviceStatus,
  refreshMachineStatus
} from '../../../../utils/asset-lifecycle'

const schema = z.object({
  machineId: z.string().min(1),
  reason: z.string().trim().min(2).max(120).default('replace-machine'),
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
    await lockMachineForUpdate(tx, body.machineId)
    await lockAssetBindingRowsForUpdate(tx, assetId, null, body.machineId)

    const [asset, newMachine] = await Promise.all([
      tx.asset.findUnique({
        where: { id: assetId },
        select: { id: true, tenantId: true }
      }),
      tx.machine.findUnique({
        where: { id: body.machineId },
        select: { id: true, tenantId: true }
      })
    ])

    if (!asset) {
      throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
    }
    if (!newMachine) {
      throw createError({ statusCode: 404, statusMessage: 'Machine not found' })
    }
    if (asset.tenantId !== newMachine.tenantId) {
      throw createError({ statusCode: 409, statusMessage: 'Machine tenant mismatch' })
    }

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
        select: { id: true, assetId: true }
      })
    ])

    if (machineActiveOnAnotherAsset) {
      throw createError({ statusCode: 409, statusMessage: 'Machine already bound to another asset' })
    }

    if (currentActive?.machineId === newMachine.id) {
      return {
        ok: true,
        changed: false,
        activeBindingId: currentActive.id
      }
    }

    const nextMachineStatus = await readMachineStatus(tx, newMachine.id)
    if (nextMachineStatus && nextMachineStatus !== 'SPARE') {
      throw createError({ statusCode: 409, statusMessage: `Only SPARE machine can be bound/replaced (current: ${nextMachineStatus})` })
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
            replacedWithMachineId: newMachine.id,
            ...(body.metadata || {})
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
          replacedFromMachineId: currentActive?.machineId || null,
          ...(body.metadata || {})
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
    if (oldIotDeviceId) {
      await refreshIotDeviceStatus(tx, oldIotDeviceId)
    }
    await refreshMachineStatus(tx, newMachine.id)
    if (created.iotDeviceId) {
      await refreshIotDeviceStatus(tx, created.iotDeviceId)
    }

    return {
      ok: true,
      changed: true,
      activeBindingId: created.id
    }
  })
})
