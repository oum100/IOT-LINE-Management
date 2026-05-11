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
            { id: { contains: q, mode: 'insensitive' as const } },
            { providerReference: { contains: q, mode: 'insensitive' as const } },
            {
              order: {
                is: {
                  orderNumber: { contains: q, mode: 'insensitive' as const }
                }
              }
            }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
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
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.payment.count({ where })
  ])

  return { items, total, page, pageSize }
})
