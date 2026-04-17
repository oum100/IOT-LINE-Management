import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

type SummaryResponse = {
  totalCount: number
  activeCount: number
  inactiveCount: number
  maintenanceCount: number
  deviceCount: number
  paymentCount: number
  orderCount: number
}

export default defineEventHandler(async (event): Promise<SummaryResponse> => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '').trim()

  if (!tenantId) {
    throw createError({ statusCode: 400, statusMessage: 'tenantId is required' })
  }

  const merchantAccountId = String(query.merchantAccountId || '').trim()
  const branchId = String(query.branchId || '').trim()

  const baseWhere = {
    tenantId,
    ...(merchantAccountId
      ? {
          branch: {
            merchantAccountId
          }
        }
      : {}),
    ...(branchId ? { branchId } : {})
  }

  const [totalCount, activeCount, inactiveCount, maintenanceCount, deviceCount, paymentCount, orderCount] = await Promise.all([
    prisma.asset.count({ where: baseWhere }),
    prisma.asset.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
    prisma.asset.count({ where: { ...baseWhere, status: 'INACTIVE' } }),
    prisma.asset.count({ where: { ...baseWhere, status: 'MAINTENANCE' } }),
    prisma.iotDevice.count({
      where: {
        bindings: {
          some: {
            asset: baseWhere
          }
        }
      }
    }),
    prisma.payment.count({
      where: {
        order: {
          items: {
            some: {
              OR: [
                {
                  asset: baseWhere
                },
                {
                  machine: {
                    asset: baseWhere
                  }
                }
              ]
            }
          }
        }
      }
    }),
    prisma.order.count({
      where: {
        items: {
          some: {
            OR: [
              {
                asset: baseWhere
              },
              {
                machine: {
                  asset: baseWhere
                }
              }
            ]
          }
        }
      }
    })
  ])

  return {
    totalCount,
    activeCount,
    inactiveCount,
    maintenanceCount,
    deviceCount,
    paymentCount,
    orderCount
  }
})
