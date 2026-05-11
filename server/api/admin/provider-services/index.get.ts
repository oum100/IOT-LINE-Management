import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const { q, skip, take, page, pageSize } = withPaging(query)
  const andWhere: any[] = []

  if (query.tenantId) andWhere.push({ tenantId: String(query.tenantId) })
  if (query.serviceType) andWhere.push({ serviceType: String(query.serviceType).toUpperCase() })
  if (query.status) andWhere.push({ status: String(query.status).toUpperCase() })
  if (q) {
    andWhere.push({
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { serviceType: { equals: q as any } }
      ]
    })
  }

  const where = andWhere.length ? { AND: andWhere } : {}
  const orm = prisma as any
  const [items, total] = await Promise.all([
    orm.providerService.findMany({
      where,
      orderBy: [{ serviceType: 'asc' }, { displayName: 'asc' }],
      skip,
      take,
      select: {
        id: true,
        tenantId: true,
        code: true,
        displayName: true,
        serviceType: true,
        status: true,
        supportsQrGeneration: true,
        supportsConfirmCallback: true,
        supportsSingleTxnVerify: true,
        supportsSingleSlipVerify: true,
        isDefault: true,
        metadata: true,
        tenant: { select: { id: true, name: true, code: true } },
        _count: { select: { providerConnections: true } }
      }
    }),
    orm.providerService.count({ where })
  ])

  return {
    items: items.map((item: any) => ({
      ...item,
      linkedCount: item._count?.providerConnections || 0,
      canDelete: (item._count?.providerConnections || 0) === 0
    })),
    total,
    page,
    pageSize
  }
})
