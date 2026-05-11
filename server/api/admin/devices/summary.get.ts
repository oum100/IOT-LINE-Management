import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

type DeviceSummary = {
  totalCount: number
  spareCount: number
  inUseCount: number
  offlineCount: number
  disabledCount: number
}

export default defineEventHandler(async (event): Promise<DeviceSummary> => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '').trim()
  const merchantAccountId = String(query.merchantAccountId || '').trim()
  const branchId = String(query.branchId || '').trim()
  const status = String(query.status || '').trim().toUpperCase()

  const baseWhere = {
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
    ...(status ? { status } : {})
  }

  const [totalCount, spareCount, inUseCount, offlineCount, disabledCount] = await Promise.all([
    prisma.iotDevice.count({ where: baseWhere }),
    prisma.iotDevice.count({ where: { ...baseWhere, status: 'SPARE' } }),
    prisma.iotDevice.count({ where: { ...baseWhere, status: 'BOUND' } }),
    prisma.iotDevice.count({ where: { ...baseWhere, status: 'OFFLINE' } }),
    prisma.iotDevice.count({ where: { ...baseWhere, status: 'DISABLED' } })
  ])

  return {
    totalCount,
    spareCount,
    inUseCount,
    offlineCount,
    disabledCount
  }
})
