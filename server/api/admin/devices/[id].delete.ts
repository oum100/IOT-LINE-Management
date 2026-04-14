import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing device id' })
  }

  await prisma.deviceApiKey.deleteMany({ where: { iotDeviceId: id } })
  await prisma.assetBinding.updateMany({
    where: { iotDeviceId: id, endedAt: null },
    data: {
      endedAt: new Date(),
      status: 'INACTIVE',
      reason: 'iot-device-removed'
    }
  })
  await prisma.iotDevice.delete({ where: { id } })

  return { ok: true }
})
