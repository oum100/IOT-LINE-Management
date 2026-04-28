import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '').trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, statusMessage: 'tenantId is required' })
  }

  const { q, skip, take, page, pageSize } = withPaging(query)
  const where = {
    tenantId,
    ...(q
      ? {
          OR: [
            { serialNo: { contains: q, mode: 'insensitive' as const } },
            { brand: { contains: q, mode: 'insensitive' as const } },
            { model: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.machineUnit.findMany({
      where,
      include: {
        bindings: {
          where: { status: 'ACTIVE', endedAt: null },
          select: { id: true, assetId: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.machineUnit.count({ where })
  ])

  return { items, total, page, pageSize }
})
