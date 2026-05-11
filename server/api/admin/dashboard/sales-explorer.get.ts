import { getQuery } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

type PeriodPreset = 'day' | 'week' | 'month' | 'year' | 'custom'
type GroupBy = 'tenant' | 'merchant' | 'branch'
type Metric = 'revenue' | 'orders' | 'payments'
type Mode = 'all' | 'top5' | 'top10' | 'custom'

const querySchema = z.object({
  groupBy: z.enum(['tenant', 'merchant', 'branch']).default('tenant'),
  metric: z.enum(['revenue', 'orders', 'payments']).default('revenue'),
  mode: z.enum(['all', 'top5', 'top10', 'custom']).default('all'),
  period: z.enum(['day', 'week', 'month', 'year', 'custom']).default('month'),
  start: z.string().optional(),
  end: z.string().optional(),
  tenantIds: z.string().optional(),
  merchantIds: z.string().optional(),
  branchIds: z.string().optional(),
  deviceTypes: z.string().optional()
})

function parseIds(raw?: string) {
  if (!raw) return [] as string[]
  return raw.split(',').map(item => item.trim()).filter(Boolean)
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
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
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
    const cursor = new Date(start)
    cursor.setMinutes(0, 0, 0)
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}-${cursor.getHours()}`
      const label = `${String(cursor.getHours()).padStart(2, '0')}:00`
      ensure(key, label)
      cursor.setHours(cursor.getHours() + 1)
    }
    return { buckets, indexByKey }
  }

  if (period === 'week') {
    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)
    while (cursor <= end) {
      const y = cursor.getFullYear()
      const m = cursor.getMonth() + 1
      const w = weekOfMonth(cursor)
      const key = `${y}-${m}-W${w}`
      const label = `${monthLabel(cursor)} W${w}`
      ensure(key, label)
      cursor.setDate(cursor.getDate() + 1)
    }
    return { buckets, indexByKey }
  }

  if (period === 'month') {
    const year = start.getFullYear()
    const month = start.getMonth() + 1
    for (let day = 1; day <= 31; day += 1) {
      const key = `${year}-${month}-${day}`
      const label = String(day)
      ensure(key, label)
    }
    return { buckets, indexByKey }
  }

  if (period === 'year') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`
      const label = monthLabel(cursor)
      ensure(key, label)
      cursor.setMonth(cursor.getMonth() + 1)
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
  if (period === 'day') {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`
  }
  if (period === 'month') {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  }
  if (period === 'week') {
    return `${date.getFullYear()}-${date.getMonth() + 1}-W${weekOfMonth(date)}`
  }
  if (period === 'year') {
    return `${date.getFullYear()}-${date.getMonth() + 1}`
  }
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const query = querySchema.parse(getQuery(event))
  const range = getRange(query.period, query.start, query.end)

  const tenantIds = parseIds(query.tenantIds)
  const merchantIds = parseIds(query.merchantIds)
  const branchIds = parseIds(query.branchIds)
  const deviceTypes = parseIds(query.deviceTypes)

  const baseWhere = {
    createdAt: { gte: range.start, lte: range.end },
    ...(tenantIds.length ? { tenantId: { in: tenantIds } } : {}),
    ...(merchantIds.length ? { merchantAccountId: { in: merchantIds } } : {}),
    ...(branchIds.length ? { branchId: { in: branchIds } } : {})
  }

  const paymentWhere = {
    createdAt: { gte: range.start, lte: range.end },
    ...(tenantIds.length ? { tenantId: { in: tenantIds } } : {}),
    ...(merchantIds.length ? { merchantAccountId: { in: merchantIds } } : {}),
    ...(branchIds.length ? { branchId: { in: branchIds } } : {})
  }

  const groupField = query.groupBy === 'tenant' ? 'tenantId' : query.groupBy === 'merchant' ? 'merchantAccountId' : 'branchId'

  const orderGroups = query.groupBy === 'tenant'
    ? await prisma.order.groupBy({ by: ['tenantId'], where: baseWhere, _sum: { totalAmount: true }, _count: { _all: true } })
    : query.groupBy === 'merchant'
      ? await prisma.order.groupBy({ by: ['merchantAccountId'], where: baseWhere, _sum: { totalAmount: true }, _count: { _all: true } })
      : await prisma.order.groupBy({ by: ['branchId'], where: baseWhere, _sum: { totalAmount: true }, _count: { _all: true } })

  const paymentGroups = query.groupBy === 'tenant'
    ? await prisma.payment.groupBy({ by: ['tenantId'], where: paymentWhere, _count: { _all: true }, _sum: { amount: true } })
    : query.groupBy === 'merchant'
      ? await prisma.payment.groupBy({ by: ['merchantAccountId'], where: paymentWhere, _count: { _all: true }, _sum: { amount: true } })
      : await prisma.payment.groupBy({ by: ['branchId'], where: paymentWhere, _count: { _all: true }, _sum: { amount: true } })

  const keyOf = (item: Record<string, string | null>) => String(item[groupField] || '')

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

  const selectedEntityIds =
    query.mode === 'custom'
      ? query.groupBy === 'tenant'
        ? tenantIds
        : query.groupBy === 'merchant'
          ? merchantIds
          : branchIds
      : []

  const entityIds = Array.from(new Set([...selectedEntityIds, ...orderMap.keys(), ...paymentMap.keys()]))

  const tenantMap = new Map<string, { code: string; name: string }>()
  const merchantMap = new Map<string, { code: string; name: string; tenantName: string }>()
  const branchMap = new Map<string, { code: string; name: string; merchantName: string; tenantName: string }>()

  if (query.groupBy === 'tenant' && entityIds.length) {
    const rows = await prisma.tenant.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, code: true, name: true }
    })
    rows.forEach(item => tenantMap.set(item.id, { code: item.code, name: item.name }))
  }

  if (query.groupBy === 'merchant' && entityIds.length) {
    const rows = await prisma.merchantAccount.findMany({
      where: { id: { in: entityIds } },
      select: {
        id: true,
        code: true,
        name: true,
        tenant: { select: { name: true } }
      }
    })
    rows.forEach(item => merchantMap.set(item.id, {
      code: item.code,
      name: item.name,
      tenantName: item.tenant?.name || '-'
    }))
  }

  if (query.groupBy === 'branch' && entityIds.length) {
    const rows = await prisma.branch.findMany({
      where: { id: { in: entityIds } },
      select: {
        id: true,
        code: true,
        name: true,
        merchantAccount: { select: { name: true } },
        tenant: { select: { name: true } }
      }
    })
    rows.forEach(item => branchMap.set(item.id, {
      code: item.code,
      name: item.name,
      merchantName: item.merchantAccount?.name || '-',
      tenantName: item.tenant?.name || '-'
    }))
  }

  const rows = entityIds.map((id) => {
    const orderData = orderMap.get(id) || { amount: 0, orderCount: 0 }
    const paymentData = paymentMap.get(id) || { paymentCount: 0, paymentAmount: 0 }

    if (query.groupBy === 'tenant') {
      const tenant = tenantMap.get(id)
      const label = tenant ? `${tenant.code} (${tenant.name})` : id
      return {
        id,
        label,
        amount: orderData.amount,
        orderCount: orderData.orderCount,
        paymentCount: paymentData.paymentCount,
        paymentAmount: paymentData.paymentAmount
      }
    }

    if (query.groupBy === 'merchant') {
      const merchant = merchantMap.get(id)
      const label = merchant ? `${merchant.code} (${merchant.name})` : id
      return {
        id,
        label,
        parentLabel: merchant?.tenantName || '-',
        amount: orderData.amount,
        orderCount: orderData.orderCount,
        paymentCount: paymentData.paymentCount,
        paymentAmount: paymentData.paymentAmount
      }
    }

    const branch = branchMap.get(id)
    const label = branch ? `${branch.code} (${branch.name})` : id
    return {
      id,
      label,
      parentLabel: branch ? `${branch.tenantName} / ${branch.merchantName}` : '-',
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
  const selectedRowIds = new Set(slicedRows.map(item => item.id))

  const totals = {
    revenue: rows.reduce((sum, item) => sum + item.amount, 0),
    orders: rows.reduce((sum, item) => sum + item.orderCount, 0),
    payments: rows.reduce((sum, item) => sum + item.paymentCount, 0)
  }

  const deviceTypeOptions = await prisma.machineKind.findMany({
    where: { active: true },
    select: { code: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
  })

  const timelineSeed = buildTimelineBuckets(query.period, range.start, range.end)
  const timelineSeriesMap = new Map(
    slicedRows.map(item => [item.id, {
      id: item.id,
      name: item.label,
      data: Array.from({ length: timelineSeed.buckets.length }, () => 0)
    }])
  )

  const deviceTypeSeriesMap = new Map<string, { id: string; name: string; data: number[] }>()
  for (const item of deviceTypeOptions) {
    if (!deviceTypes.length || deviceTypes.includes(item.code)) {
      deviceTypeSeriesMap.set(item.code, {
        id: item.code,
        name: item.name,
        data: Array.from({ length: timelineSeed.buckets.length }, () => 0)
      })
    }
  }

  if (selectedRowIds.size) {
    const orderRows = await prisma.order.findMany({
      where: {
        ...baseWhere,
        ...(query.groupBy === 'tenant' ? { tenantId: { in: Array.from(selectedRowIds) } } : {}),
        ...(query.groupBy === 'merchant' ? { merchantAccountId: { in: Array.from(selectedRowIds) } } : {}),
        ...(query.groupBy === 'branch' ? { branchId: { in: Array.from(selectedRowIds) } } : {})
      },
      select: {
        createdAt: true,
        totalAmount: true,
        tenantId: true,
        merchantAccountId: true,
        branchId: true
      }
    })

    for (const order of orderRows) {
      const id = query.groupBy === 'tenant'
        ? order.tenantId
        : query.groupBy === 'merchant'
          ? order.merchantAccountId
          : order.branchId
      if (!id) continue
      const line = timelineSeriesMap.get(id)
      if (!line) continue
      const key = bucketKeyFor(query.period, order.createdAt)
      const idx = timelineSeed.indexByKey.get(key)
      if (idx === undefined) continue
      line.data[idx] += Number(order.totalAmount || 0)
    }

    const orderItemRows = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: range.start, lte: range.end },
          ...(tenantIds.length ? { tenantId: { in: tenantIds } } : {}),
          ...(merchantIds.length ? { merchantAccountId: { in: merchantIds } } : {}),
          ...(branchIds.length ? { branchId: { in: branchIds } } : {})
        },
        asset: {
          ...(deviceTypes.length ? { kind: { in: deviceTypes } } : {})
        }
      },
      select: {
        amount: true,
        asset: { select: { kind: true } },
        order: { select: { createdAt: true } }
      }
    })

    for (const item of orderItemRows) {
      const kind = item.asset?.kind
      if (!kind) continue
      const line = deviceTypeSeriesMap.get(kind)
      if (!line) continue
      const key = bucketKeyFor(query.period, item.order.createdAt)
      const idx = timelineSeed.indexByKey.get(key)
      if (idx === undefined) continue
      line.data[idx] += Number(item.amount || 0)
    }
  }

  return {
    filters: {
      groupBy: query.groupBy,
      metric: query.metric,
      mode: query.mode,
      period: query.period,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      tenantIds,
      merchantIds,
      branchIds,
      deviceTypes
    },
    totals,
    rows: slicedRows,
    deviceTypeOptions,
    deviceTypeTimeline: {
      categories: timelineSeed.buckets.map(item => item.label),
      series: Array.from(deviceTypeSeriesMap.values())
    },
    timeline: {
      categories: timelineSeed.buckets.map(item => item.label),
      series: Array.from(timelineSeriesMap.values())
    }
  }
})
