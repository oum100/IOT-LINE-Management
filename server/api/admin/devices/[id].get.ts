import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing device id' })
  const item = await prisma.iotDevice.findUnique({
    where: { id },
    include: {
      bindings: {
        include: {
          asset: true,
          machine: true
        }
      },
      keys: true
    }
  })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  return item
})
