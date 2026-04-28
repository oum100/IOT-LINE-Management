import { getQuery } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

type PeriodPreset = '24h' | 'week' | 'month' | 'year' | 'custom'
type GroupBy = 'tenant' | 'merchant' | 'branch'
type Metric = 'revenue' | 'orders' | 'payments'
type Mode = 'all' | 'top5' | 'top10' | 'custom'

const querySchema = z.object({
  groupBy: z.enum(['tenant', 'merchant', 'branch']).default('tenant'),
  metric: z.enum(['revenue', 'orders', 'payments']).default('revenue'),
  mode: z.enum(['all', 'top5', 'top10', 'custom']).default('all'),
  period: z.enum(['24h', 'week', 'month', 'year', 'custom']).default('month'),
  start: z.string().optional(),
  end: z.string().optional(),
  tenantIds: z.string().optional(),
  merchantIds: z.string().optional(),
  branchIds: z.string().optional()
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

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const query = querySchema.parse(getQuery(event))
  const range = getRange(query.period, query.start, query.end)

  const tenantIds = parseIds(query.tenantIds)
  const merchantIds = parseIds(query.merchantIds)
  const branchIds = parseIds(query.branchIds)

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

  const totals = {
    revenue: rows.reduce((sum, item) => sum + item.amount, 0),
    orders: rows.reduce((sum, item) => sum + item.orderCount, 0),
    payments: rows.reduce((sum, item) => sum + item.paymentCount, 0)
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
      branchIds
    },
    totals,
    rows: slicedRows
  }
})
