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
  const status = String(query.status || '').trim().toUpperCase()

  const { q, skip, take, page, pageSize } = withPaging(query)
  const where = {
    ...(tenantId ? { tenantId } : {}),
    ...(merchantAccountId || branchId
      ? {
          bindings: {
            some: {
              status: 'ACTIVE' as const,
              endedAt: null,
              asset: {
                ...(merchantAccountId
                  ? {
                      branch: {
                        merchantAccountId
                      }
                    }
                  : {}),
                ...(branchId ? { branchId } : {})
              }
            }
          }
        }
      : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { macAddress: { contains: q, mode: 'insensitive' as const } },
            { deviceUid: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.iotDevice.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        bindings: {
          where: { status: 'ACTIVE', endedAt: null },
          include: {
            asset: {
              include: {
                branch: {
                  include: {
                    merchantAccount: true
                  }
                }
              }
            }
          }
        },
        keys: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.iotDevice.count({ where })
  ])

  return { items, total, page, pageSize }
})
