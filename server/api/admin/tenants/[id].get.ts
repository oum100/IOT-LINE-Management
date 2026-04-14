import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing tenant id' })

  const item = await prisma.tenant.findUnique({
    where: { id },
    include: {
      merchantAccounts: true,
      branches: true
    }
  })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  return item
})
