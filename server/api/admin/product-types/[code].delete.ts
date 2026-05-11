import { getRouterParam } from 'h3'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const rawCode = getRouterParam(event, 'code')
  if (!rawCode) {
    throw createError({ statusCode: 400, statusMessage: 'Product type code is required' })
  }

  const code = String(rawCode).toUpperCase()
  const found = await prisma.productType.findUnique({
    where: { code },
    select: { code: true }
  })
  if (!found) {
    throw createError({ statusCode: 404, statusMessage: 'Product type not found' })
  }

  const linkedProducts = await prisma.product.count({ where: { kind: code } })
  if (linkedProducts > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cannot delete product type because products are linked'
    })
  }

  await prisma.productType.delete({ where: { code } })
  return { ok: true }
})

