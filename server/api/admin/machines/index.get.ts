import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '')
  if (!tenantId) throw createError({ statusCode: 400, statusMessage: 'tenantId is required' })

  const { q, skip, take, page, pageSize } = withPaging(query)
  const where = {
    tenantId,
    ...(query.merchantAccountId ? { merchantAccountId: String(query.merchantAccountId) } : {}),
    ...(query.branchId ? { branchId: String(query.branchId) } : {}),
    ...(query.assetId ? { assetId: String(query.assetId) } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.machine.findMany({
      where,
      include: {
        merchantAccount: true,
        branch: true,
        asset: true,
        prices: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.machine.count({ where })
  ])

  return { items, total, page, pageSize }
})
