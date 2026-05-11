import { getServerSession } from '#auth'
import { getQuery } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'
type PeriodPreset = 'day' | 'week' | 'month' | 'year' | 'custom'
type IncomingPeriodPreset = PeriodPreset | '24h'
type GroupBy = 'merchant' | 'branch'
type Metric = 'revenue' | 'orders' | 'payments'
type Mode = 'all' | 'top5' | 'top10' | 'custom'

const querySchema = z.object({
  groupBy: z.enum(['merchant', 'branch']).default('merchant'),
  metric: z.enum(['revenue', 'orders', 'payments']).default('revenue'),
  mode: z.enum(['all', 'top5', 'top10', 'custom']).default('all'),
  period: z.enum(['24h', 'day', 'week', 'month', 'year', 'custom']).default('month'),
  start: z.string().optional(),
  end: z.string().optional(),
  merchantIds: z.string().optional(),
  branchIds: z.string().optional(),
  deviceTypes: z.string().optional()
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
  return undefined
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

type TimelineBucket = { key: string; label: string }

function monthLabel(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' })
}

function weekOfMonth(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const offset = first.getDay()
  return Math.ceil((date.getDate() + offset) / 7)
}

function buildTimelineBuckets(period: PeriodPreset, start: Date, end: Date) {
  const buckets: TimelineBucket[] = []
  const indexByKey = new Map<string, number>()
  const ensure = (key: string, label: string) => {
    if (indexByKey.has(key)) return
    indexByKey.set(key, buckets.length)
    buckets.push({ key, label })
  }

  if (period === 'day') {
    for (let hour = 0; hour < 24; hour += 1) {
      const key = `H${hour}`
      ensure(key, `${String(hour).padStart(2, '0')}:00`)
    }
    return { buckets, indexByKey }
  }

  if (period === 'week') {
    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)
    while (cursor <= end) {
      const w = weekOfMonth(cursor)
      const key = `W${w}`
      ensure(key, `${monthLabel(cursor)} W${w}`)
      cursor.setDate(cursor.getDate() + 1)
    }
    return { buckets, indexByKey }
  }

  if (period === 'month') {
    for (let day = 1; day <= 31; day += 1) {
      const key = `D${day}`
      ensure(key, String(day))
    }
    return { buckets, indexByKey }
  }

  if (period === 'year') {
    for (let month = 0; month < 12; month += 1) {
      const d = new Date(start.getFullYear(), month, 1)
      const key = `M${month + 1}`
      ensure(key, monthLabel(d))
    }
    return { buckets, indexByKey }
  }

  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`
    const label = cursor.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
    ensure(key, label)
    cursor.setDate(cursor.getDate() + 1)
  }
  return { buckets, indexByKey }
}

function bucketKeyFor(period: PeriodPreset, date: Date) {
  if (period === 'day') return `H${date.getHours()}`
  if (period === 'week') return `W${weekOfMonth(date)}`
  if (period === 'month') return `D${date.getDate()}`
  if (period === 'year') return `M${date.getMonth() + 1}`
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
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

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = querySchema.parse(getQuery(event))
  const period = normalizePeriod(query.period as IncomingPeriodPreset)
  const range = getRange(period, query.start, query.end)

  const scope = await resolvePortalScopeContext(user)
  const tenantScopeId = isPlatformRole(user.role) ? null : (scope.resolvedTenantId || null)
  const lockedMerchantId = isPlatformRole(user.role) ? null : (scope.lockedMerchantId || null)

  const [tenant, merchants, branches, assetTotal, assetStatusGroup, recentOrders] = await Promise.all([
    tenantScopeId
      ? prisma.tenant.findUnique({
          where: { id: tenantScopeId },
          select: { id: true, code: true, name: true }
        })
      : Promise.resolve(null),
    prisma.merchantAccount.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(scope.allowedMerchantIds !== null ? { id: { in: scope.allowedMerchantIds } } : {}),
        ...(lockedMerchantId ? { id: lockedMerchantId } : {})
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.branch.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
        ...(scope.allowedBranchIds !== null ? { id: { in: scope.allowedBranchIds } } : {}),
        ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {})
      },
      select: { id: true, code: true, name: true, merchantAccountId: true },
      orderBy: { name: 'asc' }
    }),
    prisma.asset.count({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
        ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {})
      }
    }),
    prisma.asset.groupBy({
      by: ['status'],
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
        ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {})
      },
      _count: { _all: true }
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)), lte: new Date() },
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
        ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
        ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {})
      },
      select: { createdAt: true, totalAmount: true }
    })
  ])

  const availableMerchantIds = new Set(merchants.map(item => item.id))
  const availableBranchIds = new Set(branches.map(item => item.id))

  const requestedMerchantIds = parseIds(query.merchantIds).filter(id => availableMerchantIds.has(id))
  const requestedBranchIds = parseIds(query.branchIds).filter(id => availableBranchIds.has(id))
  const requestedDeviceTypes = parseIds(query.deviceTypes)

  const orderWhere = {
    createdAt: { gte: range.start, lte: range.end },
    ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
    ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
    ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
    ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
    ...(query.mode === 'custom' && !lockedMerchantId && requestedMerchantIds.length
      ? { merchantAccountId: { in: requestedMerchantIds } }
      : {}),
    ...(query.mode === 'custom' && requestedBranchIds.length
      ? { branchId: { in: requestedBranchIds } }
      : {})
  }

  const paymentWhere = {
    createdAt: { gte: range.start, lte: range.end },
    ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
    ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
    ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
    ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
    ...(query.mode === 'custom' && !lockedMerchantId && requestedMerchantIds.length
      ? { merchantAccountId: { in: requestedMerchantIds } }
      : {}),
    ...(query.mode === 'custom' && requestedBranchIds.length
      ? { branchId: { in: requestedBranchIds } }
      : {})
  }

  const orderGroups = query.groupBy === 'merchant'
    ? await prisma.order.groupBy({ by: ['merchantAccountId'], where: orderWhere, _sum: { totalAmount: true }, _count: { _all: true } })
    : await prisma.order.groupBy({ by: ['branchId'], where: orderWhere, _sum: { totalAmount: true }, _count: { _all: true } })

  const paymentGroups = query.groupBy === 'merchant'
    ? await prisma.payment.groupBy({ by: ['merchantAccountId'], where: paymentWhere, _count: { _all: true }, _sum: { amount: true } })
    : await prisma.payment.groupBy({ by: ['branchId'], where: paymentWhere, _count: { _all: true }, _sum: { amount: true } })

  const keyField = query.groupBy === 'merchant' ? 'merchantAccountId' : 'branchId'
  const keyOf = (item: Record<string, string | null>) => String(item[keyField] || '')

  const orderMap = new Map(
    orderGroups
      .map(item => {
        const key = keyOf(item as unknown as Record<string, string | null>)
        return [key, { amount: Number(item._sum.totalAmount || 0), orderCount: item._count._all }] as const
      })
      .filter(([key]) => Boolean(key))
  )

  const paymentMap = new Map(
    paymentGroups
      .map(item => {
        const key = keyOf(item as unknown as Record<string, string | null>)
        return [key, { paymentCount: item._count._all, paymentAmount: Number(item._sum.amount || 0) }] as const
      })
      .filter(([key]) => Boolean(key))
  )

  const selectedEntityIds = query.mode === 'custom'
    ? query.groupBy === 'merchant'
      ? requestedMerchantIds
      : requestedBranchIds
    : []

  const entityIds = Array.from(new Set([...selectedEntityIds, ...orderMap.keys(), ...paymentMap.keys()]))

  const merchantMap = new Map(merchants.map(item => [item.id, item]))
  const branchMap = new Map(branches.map(item => [item.id, item]))

  const rows = entityIds.map((id) => {
    const orderData = orderMap.get(id) || { amount: 0, orderCount: 0 }
    const paymentData = paymentMap.get(id) || { paymentCount: 0, paymentAmount: 0 }

    if (query.groupBy === 'merchant') {
      const merchant = merchantMap.get(id)
      return {
        id,
        label: merchant ? `${merchant.code} (${merchant.name})` : id,
        amount: orderData.amount,
        orderCount: orderData.orderCount,
        paymentCount: paymentData.paymentCount,
        paymentAmount: paymentData.paymentAmount
      }
    }

    const branch = branchMap.get(id)
    const merchant = branch?.merchantAccountId ? merchantMap.get(branch.merchantAccountId) : null
    return {
      id,
      label: branch ? `${branch.code} (${branch.name})` : id,
      parentLabel: merchant?.name || '-',
      amount: orderData.amount,
      orderCount: orderData.orderCount,
      paymentCount: paymentData.paymentCount,
      paymentAmount: paymentData.paymentAmount
    }
  })

  const metricValue = (item: { amount: number; orderCount: number; paymentCount: number }) => {
    if (query.metric === 'orders') return item.orderCount
    if (query.metric === 'payments') return item.paymentCount
    return item.amount
  }

  rows.sort((a, b) => metricValue(b) - metricValue(a))

  const topLimit = getTopLimit(query.mode)
  const slicedRows = topLimit ? rows.slice(0, topLimit) : rows
  const slicedEntityIds = new Set(slicedRows.map(item => item.id))
  const deviceTypeOptions = await prisma.machineKind.findMany({
    select: { code: true, name: true },
    orderBy: { sortOrder: 'asc' }
  })
  const allowedDeviceTypeSet = new Set(deviceTypeOptions.map(item => item.code))
  const selectedDeviceTypeSet = new Set(requestedDeviceTypes.filter(code => allowedDeviceTypeSet.has(code)))

  const ordersForTimeline = await prisma.order.findMany({
    where: orderWhere,
    select: {
      createdAt: true,
      totalAmount: true,
      merchantAccountId: true,
      branchId: true,
      items: {
        select: {
          amount: true,
          asset: {
            select: {
              kind: true,
              machineKind: { select: { code: true, name: true } }
            }
          }
        }
      }
    }
  })
  const { buckets, indexByKey } = buildTimelineBuckets(period, range.start, range.end)
  const timelineSeriesMap = new Map(
    slicedRows.map((item) => [
      item.id,
      { id: item.id, name: item.label, data: Array.from({ length: buckets.length }, () => 0) }
    ])
  )

  const typeTotals = new Map<string, number>()
  const typeNameMap = new Map<string, string>()
  const deviceTypeSeriesMap = new Map<string, { id: string; name: string; data: number[] }>()
  for (const code of selectedDeviceTypeSet) {
    const found = deviceTypeOptions.find(item => item.code === code)
    deviceTypeSeriesMap.set(code, {
      id: code,
      name: found?.name || code,
      data: Array.from({ length: buckets.length }, () => 0)
    })
  }

  for (const order of ordersForTimeline) {
    const entityId = query.groupBy === 'merchant' ? order.merchantAccountId : order.branchId
    if (!entityId || !slicedEntityIds.has(entityId)) continue
    const bucketKey = bucketKeyFor(period, order.createdAt)
    const bucketIndex = indexByKey.get(bucketKey)
    if (bucketIndex === undefined) continue
    const timelineLine = timelineSeriesMap.get(entityId)
    if (timelineLine) {
      timelineLine.data[bucketIndex] += Number(order.totalAmount || 0)
    }
    for (const item of order.items) {
      const kindCode = item.asset?.kind || 'UNKNOWN'
      if (selectedDeviceTypeSet.size && !selectedDeviceTypeSet.has(kindCode)) continue
      const kindName = item.asset?.machineKind?.name || kindCode
      const amount = Number(item.amount || 0)
      typeNameMap.set(kindCode, kindName)
      typeTotals.set(kindCode, Number(typeTotals.get(kindCode) || 0) + amount)
      const line = deviceTypeSeriesMap.get(kindCode) || {
        id: kindCode,
        name: kindName,
        data: Array.from({ length: buckets.length }, () => 0)
      }
      line.data[bucketIndex] += amount
      deviceTypeSeriesMap.set(kindCode, line)
    }
  }

  const topDeviceTypes = Array.from(typeTotals.entries()).sort((a, b) => b[1] - a[1]).map(([code]) => code)
  const deviceTypeSeries = topDeviceTypes.map(code => deviceTypeSeriesMap.get(code)).filter((v): v is { id: string; name: string; data: number[] } => Boolean(v))

  const statusMap = new Map(assetStatusGroup.map(item => [item.status, item._count._all]))
  const assets = {
    total: assetTotal,
    active: Number(statusMap.get('ACTIVE') || 0),
    inactive: Number(statusMap.get('INACTIVE') || 0),
    maintenance: Number(statusMap.get('MAINTENANCE') || 0)
  }

  const trendBase = startOfDay(new Date())
  const trendDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(trendBase)
    day.setDate(trendBase.getDate() - (6 - index))
    return {
      key: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
      amount: 0
    }
  })
  const trendMap = new Map(trendDays.map(item => [item.key, item]))
  for (const order of recentOrders) {
    const key = startOfDay(order.createdAt).toISOString().slice(0, 10)
    const target = trendMap.get(key)
    if (target) {
      target.amount += Number(order.totalAmount || 0)
    }
  }

  return {
    filters: {
      groupBy: query.groupBy,
      metric: query.metric,
      mode: query.mode,
      period,
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
    totals: {
      revenue: rows.reduce((sum, item) => sum + item.amount, 0),
      orders: rows.reduce((sum, item) => sum + item.orderCount, 0),
      payments: rows.reduce((sum, item) => sum + item.paymentCount, 0)
    },
    rows: slicedRows,
    timeline: {
      categories: buckets.map(item => item.label),
      series: Array.from(timelineSeriesMap.values())
    },
    deviceTypeTimeline: {
      categories: buckets.map(item => item.label),
      series: deviceTypeSeries
    },
    deviceTypeOptions,
    assets,
    trend7d: trendDays
  }
})
