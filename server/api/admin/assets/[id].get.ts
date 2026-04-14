import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  const item = await prisma.asset.findUnique({
    where: { id },
    include: {
      branch: true,
      machines: true,
      bindings: {
        include: {
          machineUnit: true,
          iotDevice: true
        }
      }
    }
  })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  return item
})
