import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '').trim()
  const merchantAccountId = String(query.merchantAccountId || '').trim()
  const branchId = String(query.branchId || '').trim()
  const kind = String(query.kind || '').trim().toUpperCase()
  const active = String(query.active || '').trim()

  const { q, skip, take, page, pageSize } = withPaging(query)

  const where = {
    ...(tenantId ? { tenantId } : {}),
    ...(kind ? { kind } : {}),
    ...(active === 'true' ? { active: true } : {}),
    ...(active === 'false' ? { active: false } : {}),
    ...(merchantAccountId || branchId
      ? {
          prices: {
            some: {
              ...(branchId
                ? { asset: { branchId } }
                : { asset: { branch: { merchantAccountId } } })
            }
          }
        }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
            { id: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        _count: {
          select: {
            prices: true,
            offers: true,
            orderItems: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.product.count({ where })
  ])

  return { items, total, page, pageSize }
})
