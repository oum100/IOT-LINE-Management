import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '').trim()
  const merchantAccountId = String(query.merchantAccountId || '').trim()
  const branchId = String(query.branchId || '').trim()
  const kind = String(query.kind || '').trim().toUpperCase()
  const orderWhere = {
    ...(tenantId ? { tenantId } : {}),
    ...(merchantAccountId ? { merchantAccountId } : {}),
    ...(branchId ? { branchId } : {})
  }

  const where = {
    ...(tenantId ? { tenantId } : {}),
    ...(kind ? { kind } : {}),
    ...(merchantAccountId || branchId
      ? {
          prices: {
            some: {
              ...(branchId
                ? { asset: { branchId } }
                : { asset: { branch: { merchantAccountId } } })
            }
          }
        }
      : {})
  }

  const [
    totalCount,
    activeCount,
    inactiveCount,
    washerCount,
    dryerCount,
    unitCount,
    totalBindings,
    totalSoldItems
  ] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count({ where: { ...where, active: true } }),
    prisma.product.count({ where: { ...where, active: false } }),
    prisma.product.count({ where: { ...where, kind: 'WASHER' } }),
    prisma.product.count({ where: { ...where, kind: 'DRYER' } }),
    prisma.product.count({ where: { ...where, serviceMode: { not: 'TIME' } } }),
    prisma.assetProductPrice.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(merchantAccountId || branchId
          ? {
              asset: branchId
                ? { branchId }
                : { branch: { merchantAccountId } }
            }
          : {})
      }
    }),
    prisma.orderItem.count({
      where: {
        ...(Object.keys(orderWhere).length ? { order: orderWhere } : {}),
        ...(kind ? { product: { kind } } : {})
      }
    })
  ])

  return {
    totalCount,
    activeCount,
    inactiveCount,
    washerCount,
    dryerCount,
    unitCount,
    totalBindings,
    totalSoldItems
  }
})
