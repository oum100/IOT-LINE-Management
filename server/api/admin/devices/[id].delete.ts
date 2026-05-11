import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing device id' })
  }

  const device = await prisma.iotDevice.findUnique({
    where: { id },
    select: { id: true, deviceUid: true, macAddress: true, status: true }
  })
  if (!device) throw createError({ statusCode: 404, statusMessage: 'Device not found' })

  const allowedDeleteStatuses = new Set(['NEW', 'SPARE', 'REPLACED', 'OFFLINE', 'DISABLED'])
  if (!allowedDeleteStatuses.has(device.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only unbound device statuses can be deleted.'
    })
  }

  await requireDeleteConfirm(event)

  const activeBindingCount = await prisma.assetBinding.count({
    where: {
      iotDeviceId: id,
      status: 'ACTIVE',
      endedAt: null
    }
  })
  if (activeBindingCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Device is still actively bound. Delete is blocked.'
    })
  }

  await prisma.iotDevice.delete({ where: { id } })

  return { ok: true }
})
