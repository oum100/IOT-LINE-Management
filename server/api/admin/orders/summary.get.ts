import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

type OrderSummary = {
  totalCount: number
  pendingPaymentCount: number
  slipUploadedCount: number
  confirmedCount: number
  inProgressCount: number
  completedCount: number
  cancelledCount: number
}

export default defineEventHandler(async (event): Promise<OrderSummary> => {
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

  const [
    totalCount,
    pendingPaymentCount,
    slipUploadedCount,
    confirmedCount,
    inProgressCount,
    completedCount,
    cancelledCount
  ] = await Promise.all([
    prisma.order.count({ where: baseWhere }),
    prisma.order.count({ where: { ...baseWhere, status: 'PENDING_PAYMENT' } }),
    prisma.order.count({ where: { ...baseWhere, status: 'SLIP_UPLOADED' } }),
    prisma.order.count({ where: { ...baseWhere, status: 'CONFIRMED' } }),
    prisma.order.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
    prisma.order.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
    prisma.order.count({ where: { ...baseWhere, status: 'CANCELLED' } })
  ])

  return {
    totalCount,
    pendingPaymentCount,
    slipUploadedCount,
    confirmedCount,
    inProgressCount,
    completedCount,
    cancelledCount
  }
})
