import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

type PaymentSummary = {
  totalCount: number
  pendingCount: number
  slipUploadedCount: number
  verifiedCount: number
  rejectedCount: number
}

export default defineEventHandler(async (event): Promise<PaymentSummary> => {
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

  const [totalCount, pendingCount, slipUploadedCount, verifiedCount, rejectedCount] = await Promise.all([
    prisma.payment.count({ where: baseWhere }),
    prisma.payment.count({ where: { ...baseWhere, status: 'PENDING' } }),
    prisma.payment.count({ where: { ...baseWhere, status: 'SLIP_UPLOADED' } }),
    prisma.payment.count({ where: { ...baseWhere, status: 'VERIFIED' } }),
    prisma.payment.count({ where: { ...baseWhere, status: 'REJECTED' } })
  ])

  return {
    totalCount,
    pendingCount,
    slipUploadedCount,
    verifiedCount,
    rejectedCount
  }
})
