import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const { q, skip, take, page, pageSize } = withPaging(query)

  const andWhere: any[] = []

  if (query.tenantId) {
    andWhere.push({ tenantId: String(query.tenantId) })
  }

  if (query.providerCode) {
    andWhere.push({ providerCode: String(query.providerCode).toUpperCase() })
  }

  if (q) {
    andWhere.push({
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { providerCode: { contains: q, mode: 'insensitive' } },
        { baseUrl: { contains: q, mode: 'insensitive' } }
      ]
    })
  }

  const where = andWhere.length ? { AND: andWhere } : {}
  const orm = prisma as any

  const [items, total] = await Promise.all([
    orm.providerConnection.findMany({
      where,
      orderBy: [{ displayName: 'asc' }],
      skip,
      take,
      select: {
        id: true,
        tenantId: true,
        code: true,
        displayName: true,
        providerServiceId: true,
        providerCode: true,
        status: true,
        baseUrl: true,
        appKey: true,
        appSecret: true,
        webhookSecret: true,
        supportsQrIssue: true,
        supportsCallback: true,
        supportsSlipVerify: true,
        credentials: true,
        tenant: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        providerService: {
          select: {
            id: true,
            code: true,
            displayName: true,
            serviceType: true
          }
        },
        _count: {
          select: {
            billerProfiles: true
          }
        }
      }
    }),
    orm.providerConnection.count({ where })
  ])

  return {
    items: items.map((item: any) => ({
      ...item,
      linkedCount: item._count?.billerProfiles || 0,
      canDelete: (item._count?.billerProfiles || 0) === 0
    })),
    total,
    page,
    pageSize
  }
})
