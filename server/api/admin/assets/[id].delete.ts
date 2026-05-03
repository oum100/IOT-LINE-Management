import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, name: true }
  })
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })

  await requireDeleteConfirm(event, asset.name)

  const orderItemCount = await prisma.orderItem.count({ where: { assetId: id } })
  if (orderItemCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Asset has linked orders. Delete is blocked.'
    })
  }

  await prisma.$transaction(async (tx) => {
    const activeBindings = await tx.assetBinding.findMany({
      where: {
        assetId: id,
        status: 'ACTIVE',
        endedAt: null
      },
      select: {
        id: true,
        iotDeviceId: true,
        machineUnitId: true
      }
    })

    const iotIds = Array.from(new Set(activeBindings.map(item => item.iotDeviceId).filter(Boolean))) as string[]
    const machineUnitIds = Array.from(new Set(activeBindings.map(item => item.machineUnitId).filter(Boolean))) as string[]

    if (activeBindings.length) {
      await tx.assetBinding.updateMany({
        where: { id: { in: activeBindings.map(item => item.id) } },
        data: {
          status: 'INACTIVE',
          endedAt: new Date(),
          reason: 'Asset deleted'
        }
      })
    }

    if (iotIds.length) {
      await tx.iotDevice.updateMany({
        where: { id: { in: iotIds } },
        data: { status: 'SPARE' }
      })
    }

    if (machineUnitIds.length) {
      await tx.machineUnit.updateMany({
        where: { id: { in: machineUnitIds } },
        data: { status: 'SPARE' }
      })
    }

    await tx.asset.delete({ where: { id } })
  })
  return { ok: true }
})
