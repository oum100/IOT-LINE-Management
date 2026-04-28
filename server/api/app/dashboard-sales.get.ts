import { getServerSession } from '#auth'
import { getQuery } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'
type PeriodPreset = '24h' | 'week' | 'month' | 'year' | 'custom'

const querySchema = z.object({
  mode: z.enum(['all', 'top5', 'top10', 'custom']).default('all'),
  period: z.enum(['24h', 'week', 'month', 'year', 'custom']).default('month'),
  start: z.string().optional(),
  end: z.string().optional(),
  merchantIds: z.string().optional(),
  branchIds: z.string().optional()
})

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

function parseIds(raw?: string) {
  if (!raw) return []
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function getRange(period: PeriodPreset, startRaw?: string, endRaw?: string) {
  const now = new Date()
  if (period === 'custom') {
    const start = startRaw ? new Date(startRaw) : new Date(now.getFullYear(), now.getMonth(), 1)
    const end = endRaw ? new Date(endRaw) : now
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if ((period === 'week' || period === 'month' || period === 'year') && startRaw && endRaw) {
    return {
      start: new Date(startRaw),
      end: new Date(endRaw)
    }
  }
  if (period === '24h') {
    const start = new Date(now)
    start.setHours(start.getHours() - 24)
    return { start, end: now }
  }
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return { start, end: now }
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, end: now }
  }
  const start = new Date(now.getFullYear(), 0, 1)
  return { start, end: now }
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = querySchema.parse(getQuery(event))
  const range = getRange(query.period, query.start, query.end)

  const tenantScopeId = isPlatformRole(user.role) ? null : (user.tenantId || null)
  const lockedMerchantId = isPlatformRole(user.role) ? null : (user.merchantAccountId || null)

  const [tenant, merchants, branches] = await Promise.all([
    tenantScopeId
      ? prisma.tenant.findUnique({
          where: { id: tenantScopeId },
          select: { id: true, code: true, name: true }
        })
      : Promise.resolve(null),
    prisma.merchantAccount.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(lockedMerchantId ? { id: lockedMerchantId } : {})
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.branch.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {})
      },
      select: { id: true, code: true, name: true, merchantAccountId: true },
      orderBy: { name: 'asc' }
    })
  ])

  const availableMerchantIds = new Set(merchants.map(item => item.id))
  const availableBranchIds = new Set(branches.map(item => item.id))
  const requestedMerchantIds = parseIds(query.merchantIds).filter(id => availableMerchantIds.has(id))
  const requestedBranchIds = parseIds(query.branchIds).filter(id => availableBranchIds.has(id))

  const where: {
    tenantId?: string
    merchantAccountId?: string | { in: string[] }
    branchId?: { in: string[] }
    createdAt: { gte: Date; lte: Date }
  } = {
    createdAt: { gte: range.start, lte: range.end }
  }

  if (tenantScopeId) {
    where.tenantId = tenantScopeId
  }
  if (lockedMerchantId) {
    where.merchantAccountId = lockedMerchantId
  }

  if (query.mode === 'custom') {
    if (!lockedMerchantId && requestedMerchantIds.length) {
      where.merchantAccountId = { in: requestedMerchantIds }
    }
    if (requestedBranchIds.length) {
      where.branchId = { in: requestedBranchIds }
    }
  }

  const grouped = await prisma.order.groupBy({
    by: ['merchantAccountId'],
    where,
    _sum: { totalAmount: true },
    _count: { _all: true }
  })

  const merchantMap = new Map(merchants.map(item => [item.id, item]))
  let rows = grouped
    .map(item => {
      const merchant = item.merchantAccountId ? merchantMap.get(item.merchantAccountId) : null
      return {
        merchantId: item.merchantAccountId || null,
        merchantName: merchant?.name || 'Unknown Merchant',
        amount: Number(item._sum.totalAmount || 0),
        orderCount: item._count._all
      }
    })
    .sort((a, b) => b.amount - a.amount)

  if (query.mode === 'top5') rows = rows.slice(0, 5)
  if (query.mode === 'top10') rows = rows.slice(0, 10)

  const totalAmount = rows.reduce((sum, item) => sum + item.amount, 0)

  return {
    filters: {
      mode: query.mode,
      period: query.period,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      merchantIds: requestedMerchantIds,
      branchIds: requestedBranchIds
    },
    tenant,
    options: {
      merchants,
      branches
    },
    sales: {
      totalAmount,
      byMerchant: rows
    }
  }
})
