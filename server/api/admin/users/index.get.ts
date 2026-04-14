import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const { q, skip, take, page, pageSize } = withPaging(query)
  const where = {
    ...(query.tenantId ? { tenantId: String(query.tenantId) } : {}),
    ...(query.merchantAccountId ? { merchantAccountId: String(query.merchantAccountId) } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        tenantId: true,
        merchantAccountId: true,
        createdAt: true
      }
    }),
    prisma.user.count({ where })
  ])
  return { items, total, page, pageSize }
})
