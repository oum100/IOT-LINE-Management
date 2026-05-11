import { assertAdminAccess } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const items = await prisma.serviceModeType.findMany({
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
  })
  return { items }
})
