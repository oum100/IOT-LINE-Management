import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '')
  if (!tenantId) throw createError({ statusCode: 400, statusMessage: 'tenantId is required' })

  const { skip, take, page, pageSize } = withPaging(query)
  const where = {
    tenantId,
    ...(query.merchantAccountId ? { merchantAccountId: String(query.merchantAccountId) } : {}),
    ...(query.branchId ? { branchId: String(query.branchId) } : {})
  }
  const [items, total] = await Promise.all([
    prisma.deviceRegistrationCode.findMany({
      where,
      include: { tenant: true, merchantAccount: true, branch: true, usedByIotDevice: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.deviceRegistrationCode.count({ where })
  ])
  return { items, total, page, pageSize }
})
