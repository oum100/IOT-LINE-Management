import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

type MachineSummary = {
  totalCount: number
  availableCount: number
  reservedCount: number
  runningCount: number
  maintenanceCount: number
}

export default defineEventHandler(async (event): Promise<MachineSummary> => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '').trim()
  const merchantAccountId = String(query.merchantAccountId || '').trim()
  const branchId = String(query.branchId || '').trim()

  const baseWhere = {
    ...(tenantId ? { tenantId } : {}),
    ...(merchantAccountId ? { merchantAccountId } : {}),
    ...(branchId ? { branchId } : {})
  }

  const [totalCount, availableCount, reservedCount, runningCount, maintenanceCount] = await Promise.all([
    prisma.machine.count({ where: baseWhere }),
    prisma.machine.count({ where: { ...baseWhere, status: 'AVAILABLE' } }),
    prisma.machine.count({ where: { ...baseWhere, status: 'RESERVED' } }),
    prisma.machine.count({ where: { ...baseWhere, status: 'RUNNING' } }),
    prisma.machine.count({ where: { ...baseWhere, status: 'MAINTENANCE' } })
  ])

  return {
    totalCount,
    availableCount,
    reservedCount,
    runningCount,
    maintenanceCount
  }
})
