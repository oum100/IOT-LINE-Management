import { assertAdminAccess } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const itemsRaw = await prisma.productType.findMany({
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
  })
  const items = await Promise.all(
    itemsRaw.map(async (item) => {
      const linkedProducts = await prisma.product.count({ where: { kind: item.code } })
      return {
        ...item,
        linkedProducts,
        canDelete: linkedProducts === 0
      }
    })
  )
  return { items }
})
