import { getServerSession } from '#auth'
import { getQuery } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertPermission, isPlatformRole, resolvePortalScopeContext } from '../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

const querySchema = z.object({
  period: z.enum(['24h', 'week', 'month', 'year', 'custom']).default('month'),
  start: z.string().optional(),
  end: z.string().optional(),
  merchantIds: z.string().optional(),
  branchIds: z.string().optional()
})

function parseIds(raw?: string) {
  if (!raw) return []
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

function getRange(period: '24h' | 'week' | 'month' | 'year' | 'custom', startRaw?: string, endRaw?: string) {
  const now = new Date()
  if (period === 'custom') {
    const start = startRaw ? new Date(startRaw) : new Date(now.getFullYear(), now.getMonth(), 1)
    const end = endRaw ? new Date(endRaw) : now
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (period === '24h') {
    const start = new Date(now)
    start.setHours(start.getHours() - 24)
    return { start, end: now }
  }
  if (period === 'week') {
    const day = now.getDay()
    const start = new Date(now)
    start.setDate(now.getDate() - day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }
  const start = new Date(now.getFullYear(), 0, 1)
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
  return { start, end }
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.expense.read')
  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const query = querySchema.parse(getQuery(event))
  const range = getRange(query.period, query.start, query.end)

  const scope = await resolvePortalScopeContext(user)
  const tenantScopeId = isPlatformRole(user.role) ? null : (scope.resolvedTenantId || null)
  const lockedMerchantId = isPlatformRole(user.role) ? null : (scope.lockedMerchantId || null)
  if (!isPlatformRole(user.role) && !tenantScopeId && !lockedMerchantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }

  const requestedMerchantIds = parseIds(query.merchantIds)
  const requestedBranchIds = parseIds(query.branchIds)

  const where = {
    occurredAt: { gte: range.start, lte: range.end },
    ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
    ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
    ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
    ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
    ...(!lockedMerchantId && requestedMerchantIds.length ? { merchantAccountId: { in: requestedMerchantIds } } : {}),
    ...(requestedBranchIds.length ? { branchId: { in: requestedBranchIds } } : {})
  }

  const [total, byTypeRaw] = await Promise.all([
    prisma.expense.aggregate({
      where,
      _sum: { amount: true }
    }),
    prisma.expense.groupBy({
      by: ['expenseTypeId'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    })
  ])

  const typeIds = byTypeRaw.map(item => item.expenseTypeId)
  const types = typeIds.length
    ? await prisma.expenseType.findMany({
        where: { id: { in: typeIds } },
        select: { id: true, code: true, name: true }
      })
    : []
  const typeMap = new Map(types.map(item => [item.id, item]))

  return {
    filters: {
      period: query.period,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      merchantIds: requestedMerchantIds,
      branchIds: requestedBranchIds
    },
    totalExpense: Number(total._sum.amount || 0),
    byType: byTypeRaw.map(item => {
      const type = typeMap.get(item.expenseTypeId)
      return {
        expenseTypeId: item.expenseTypeId,
        code: type?.code || '-',
        name: type?.name || 'Unknown',
        amount: Number(item._sum.amount || 0)
      }
    })
  }
})
