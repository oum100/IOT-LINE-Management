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
    ...(query.branchId ? { branchId: String(query.branchId) } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
            { assetUuid: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.asset.count({ where })
  ])

  return { items, total, page, pageSize }
})
