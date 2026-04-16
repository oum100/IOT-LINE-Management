import { z } from 'zod'
import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const querySchema = z.object({
  top: z.coerce.number().int().min(1).max(50).default(5),
  period: z.enum(['24h', 'week', 'month', 'year', 'custom']).default('month'),
  start: z.string().optional(),
  end: z.string().optional(),
  tenantIds: z.string().optional()
})

function parseTenantIds(raw?: string) {
  if (!raw) return []
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function getRange(period: '24h' | 'week' | 'month' | 'year' | 'custom', startRaw?: string, endRaw?: string) {
  const now = new Date()
  if (period === 'custom') {
    const start = startRaw ? new Date(startRaw) : new Date(now.getFullYear(), now.getMonth(), 1)
    const end = endRaw ? new Date(endRaw) : now
    return { start, end }
  }

  const start = new Date(now)
  if (period === '24h') start.setHours(start.getHours() - 24)
  if (period === 'week') start.setDate(start.getDate() - 7)
  if (period === 'month') start.setMonth(start.getMonth() - 1)
  if (period === 'year') start.setFullYear(start.getFullYear() - 1)
  return { start, end: now }
}

function toBreakdown(group: Array<{ status: string; _count: { _all: number } }>) {
  return group.map(item => ({
    label: item.status,
    count: item._count._all
  }))
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const query = querySchema.parse(getQuery(event))
  const tenantIds = parseTenantIds(query.tenantIds)
  const tenantIdFilter = tenantIds.length ? { in: tenantIds } : undefined
  const range = getRange(query.period, query.start, query.end)

  const tenantWhere = tenantIdFilter ? { id: tenantIdFilter } : {}
  const byTenantWhere = tenantIdFilter ? { tenantId: tenantIdFilter } : {}
  const salesWhere = {
    ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
    createdAt: { gte: range.start, lte: range.end }
  }

  const [tenantRows, salesByTenantRaw] = await Promise.all([
    prisma.tenant.findMany({
      where: tenantWhere,
      select: { id: true, code: true, name: true, status: true }
    }),
    prisma.order.groupBy({
      by: ['tenantId'],
      where: salesWhere,
      _sum: { totalAmount: true },
      _count: { _all: true }
    })
  ])

  const tenantMap = new Map(tenantRows.map(item => [item.id, item]))
  const salesByTenant = salesByTenantRaw
    .map(item => {
      const tenantId = item.tenantId || ''
      const tenant = tenantMap.get(tenantId)
      return {
        tenantId,
        tenantCode: tenant?.code || '-',
        tenantName: tenant?.name || 'Unknown',
        amount: Number(item._sum.totalAmount || 0),
        orderCount: item._count._all
      }
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, query.top)

  const [
    tenantTotal,
    tenantStatus,
    merchantTotal,
    merchantStatus,
    branchTotal,
    branchStatus,
    assetTotal,
    assetStatus,
    deviceTotal,
    deviceBindingStatus,
    unboundDeviceCount,
    userTotal,
    userActiveGroup,
    userRoleGroup,
    orderTotal,
    orderStatus,
    paymentTotal,
    paymentStatus
  ] = await Promise.all([
    prisma.tenant.count({ where: tenantWhere }),
    prisma.tenant.groupBy({
      by: ['status'],
      where: tenantWhere,
      _count: { _all: true }
    }),
    prisma.merchantAccount.count({ where: byTenantWhere }),
    prisma.merchantAccount.groupBy({
      by: ['status'],
      where: byTenantWhere,
      _count: { _all: true }
    }),
    prisma.branch.count({ where: byTenantWhere }),
    prisma.branch.groupBy({
      by: ['status'],
      where: byTenantWhere,
      _count: { _all: true }
    }),
    prisma.asset.count({ where: byTenantWhere }),
    prisma.asset.groupBy({
      by: ['status'],
      where: byTenantWhere,
      _count: { _all: true }
    }),
    prisma.iotDevice.count({ where: byTenantWhere }),
    prisma.assetBinding.groupBy({
      by: ['status'],
      where: {
        ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
        iotDeviceId: { not: null }
      },
      _count: { _all: true }
    }),
    prisma.iotDevice.count({
      where: {
        ...byTenantWhere,
        bindings: {
          none: {
            status: 'ACTIVE',
            endedAt: null
          }
        }
      }
    }),
    prisma.user.count({ where: byTenantWhere }),
    prisma.user.groupBy({
      by: ['isActive'],
      where: byTenantWhere,
      _count: { _all: true }
    }),
    prisma.user.groupBy({
      by: ['role'],
      where: byTenantWhere,
      _count: { _all: true }
    }),
    prisma.order.count({ where: byTenantWhere }),
    prisma.order.groupBy({
      by: ['status'],
      where: byTenantWhere,
      _count: { _all: true }
    }),
    prisma.payment.count({ where: byTenantWhere }),
    prisma.payment.groupBy({
      by: ['status'],
      where: byTenantWhere,
      _count: { _all: true }
    })
  ])

  return {
    filters: {
      top: query.top,
      period: query.period,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      tenantIds
    },
    sales: {
      totalAmount: salesByTenant.reduce((sum, item) => sum + item.amount, 0),
      byTenant: salesByTenant
    },
    cards: [
      {
        key: 'tenants',
        title: 'Tenants',
        total: tenantTotal,
        statuses: toBreakdown(tenantStatus.map(item => ({ status: item.status, _count: item._count })))
      },
      {
        key: 'merchants',
        title: 'Merchants',
        total: merchantTotal,
        statuses: toBreakdown(merchantStatus.map(item => ({ status: item.status, _count: item._count })))
      },
      {
        key: 'branches',
        title: 'Branches',
        total: branchTotal,
        statuses: toBreakdown(branchStatus.map(item => ({ status: item.status, _count: item._count })))
      },
      {
        key: 'assets',
        title: 'Assets',
        total: assetTotal,
        statuses: toBreakdown(assetStatus.map(item => ({ status: item.status, _count: item._count })))
      },
      {
        key: 'devices',
        title: 'Devices',
        total: deviceTotal,
        statuses: [
          ...toBreakdown(deviceBindingStatus.map(item => ({ status: `BIND_${item.status}`, _count: item._count }))),
          { label: 'UNBOUND', count: unboundDeviceCount }
        ]
      },
      {
        key: 'users',
        title: 'Users',
        total: userTotal,
        statuses: [
          ...userActiveGroup.map(item => ({
            label: item.isActive ? 'ACTIVE' : 'INACTIVE',
            count: item._count._all
          })),
          ...userRoleGroup.map(item => ({
            label: item.role,
            count: item._count._all
          }))
        ]
      },
      {
        key: 'orders',
        title: 'Orders',
        total: orderTotal,
        statuses: toBreakdown(orderStatus.map(item => ({ status: item.status, _count: item._count })))
      },
      {
        key: 'payments',
        title: 'Payments',
        total: paymentTotal,
        statuses: toBreakdown(paymentStatus.map(item => ({ status: item.status, _count: item._count })))
      }
    ]
  }
})
