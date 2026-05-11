import { getServerSession } from '#auth'
import { getQuery } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'
type PeriodPreset = 'day' | 'week' | 'month' | 'year' | 'custom'
type IncomingPeriodPreset = PeriodPreset | '24h'
type Mode = 'all' | 'top5' | 'top10' | 'custom'

const querySchema = z.object({
  mode: z.enum(['all', 'top5', 'top10', 'custom']).default('all'),
  period: z.enum(['24h', 'day', 'week', 'month', 'year', 'custom']).default('month'),
  start: z.string().optional(),
  end: z.string().optional(),
  merchantIds: z.string().optional(),
  branchIds: z.string().optional()
})

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

function parseIds(raw?: string) {
  if (!raw) return [] as string[]
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

function normalizePeriod(period: IncomingPeriodPreset): PeriodPreset {
  return period === '24h' ? 'day' : period
}

function getRange(period: PeriodPreset, startRaw?: string, endRaw?: string) {
  const now = new Date()

  if (period === 'custom') {
    const start = startRaw ? new Date(startRaw) : new Date(now.getFullYear(), now.getMonth(), 1)
    const end = endRaw ? new Date(endRaw) : now
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if ((period === 'day' || period === 'week' || period === 'month' || period === 'year') && startRaw && endRaw) {
    return {
      start: new Date(startRaw),
      end: new Date(endRaw)
    }
  }

  if (period === 'day') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return { start, end }
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

function getTopLimit(mode: Mode) {
  if (mode === 'top5') return 5
  if (mode === 'top10') return 10
  return 15
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.revenue.read')
  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const query = querySchema.parse(getQuery(event))
  const period = normalizePeriod(query.period as IncomingPeriodPreset)
  const { start, end } = getRange(period, query.start, query.end)

  const scope = await resolvePortalScopeContext(user)
  const tenantScopeId = isPlatformRole(user.role) ? null : (scope.resolvedTenantId || null)
  const lockedMerchantId = isPlatformRole(user.role) ? null : (scope.lockedMerchantId || null)

  const [merchants, branches] = await Promise.all([
    prisma.merchantAccount.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(scope.allowedMerchantIds !== null ? { id: { in: scope.allowedMerchantIds } } : {}),
        ...(lockedMerchantId ? { id: lockedMerchantId } : {})
      },
      select: { id: true }
    }),
    prisma.branch.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
        ...(scope.allowedBranchIds !== null ? { id: { in: scope.allowedBranchIds } } : {}),
        ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {})
      },
      select: { id: true }
    })
  ])

  const availableMerchantIds = new Set(merchants.map(item => item.id))
  const availableBranchIds = new Set(branches.map(item => item.id))
  const requestedMerchantIds = parseIds(query.merchantIds).filter(id => availableMerchantIds.has(id))
  const requestedBranchIds = parseIds(query.branchIds).filter(id => availableBranchIds.has(id))

  const orderWhere = {
    createdAt: { gte: start, lte: end },
    ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
    ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
    ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
    ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
    ...(query.mode === 'custom' && !lockedMerchantId && requestedMerchantIds.length ? { merchantAccountId: { in: requestedMerchantIds } } : {}),
    ...(query.mode === 'custom' && requestedBranchIds.length ? { branchId: { in: requestedBranchIds } } : {})
  }

  const grouped = await prisma.orderItem.groupBy({
    by: ['assetId'],
    where: {
      order: { is: orderWhere }
    },
    _count: { _all: true },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: getTopLimit(query.mode)
  })

  const assetIds = grouped.map(item => item.assetId).filter((id): id is string => Boolean(id))
  const assets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, code: true, name: true }
      })
    : []
  const assetMap = new Map(assets.map(item => [item.id, item]))

  const rows: Array<{
    name: string
    used: number
    revenue: number
  }> = []

  for (const item of grouped) {
    if (!item.assetId) continue
    const info = assetMap.get(item.assetId)
    rows.push({
      name: info?.name || item.assetId,
      used: Number(item._count._all || 0),
      revenue: Number(item._sum.amount || 0)
    })
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))

  const categories = rows.map(item => item.name)
  const usedSeries = rows.map(item => item.used)
  const revenueSeries = rows.map(item => item.revenue)

  return {
    filters: {
      period,
      start: start.toISOString(),
      end: end.toISOString()
    },
    categories,
    series: [
      { name: 'Asset Used', data: usedSeries },
      { name: 'Revenue by Usage', data: revenueSeries }
    ]
  }
})
