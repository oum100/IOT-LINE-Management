import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing machine id' })
  const item = await prisma.machine.findUnique({
    where: { id },
    include: {
      merchantAccount: true,
      branch: true,
      asset: true,
      prices: true
    }
  })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Machine not found' })
  return item
})
