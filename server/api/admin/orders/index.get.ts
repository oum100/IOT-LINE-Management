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

  const { q, skip, take, page, pageSize } = withPaging(query)
  const where = {
    ...(tenantId ? { tenantId } : {}),
    ...(merchantAccountId ? { merchantAccountId } : {}),
    ...(branchId ? { branchId } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' as const } },
            { customerName: { contains: q, mode: 'insensitive' as const } },
            { id: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, code: true, name: true }
        },
        merchantAccount: {
          select: { id: true, code: true, name: true }
        },
        branch: {
          select: { id: true, code: true, name: true }
        },
        payment: {
          select: {
            id: true,
            status: true,
            amount: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.order.count({ where })
  ])

  return { items, total, page, pageSize }
})
