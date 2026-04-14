import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const iotDeviceId = String(query.iotDeviceId || '')
  if (!iotDeviceId) throw createError({ statusCode: 400, statusMessage: 'iotDeviceId is required' })

  return prisma.deviceApiKey.findMany({
    where: { iotDeviceId },
    orderBy: { createdAt: 'desc' }
  })
})
