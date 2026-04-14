import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing merchant id' })

  const item = await prisma.merchantAccount.findUnique({
    where: { id },
    include: {
      branches: true
    }
  })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Merchant not found' })
  return item
})
