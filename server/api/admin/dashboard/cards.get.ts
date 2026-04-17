import { z } from 'zod'
import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const querySchema = z.object({
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

  const tenantWhere = {
    ...(tenantIdFilter ? { id: tenantIdFilter } : {}),
    createdAt: { gte: range.start, lte: range.end }
  }
  const byTenantWhere = tenantIdFilter ? { tenantId: tenantIdFilter } : {}
  const byTenantAndDateWhere = {
    ...byTenantWhere,
    createdAt: { gte: range.start, lte: range.end }
  }

  const [
    tenantTotal,
    tenantStatus,
    merchantTotal,
    merchantStatus,
    branchTotal,
    branchStatus,
    assetTotal,
    assetStatus,
    assetTypeGroup,
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
    prisma.merchantAccount.count({ where: byTenantAndDateWhere }),
    prisma.merchantAccount.groupBy({
      by: ['status'],
      where: byTenantAndDateWhere,
      _count: { _all: true }
    }),
    prisma.branch.count({ where: byTenantAndDateWhere }),
    prisma.branch.groupBy({
      by: ['status'],
      where: byTenantAndDateWhere,
      _count: { _all: true }
    }),
    prisma.asset.count({ where: byTenantAndDateWhere }),
    prisma.asset.groupBy({
      by: ['status'],
      where: byTenantAndDateWhere,
      _count: { _all: true }
    }),
    prisma.asset.groupBy({
      by: ['kind'],
      where: byTenantAndDateWhere,
      _count: { _all: true }
    }),
    prisma.iotDevice.count({ where: byTenantAndDateWhere }),
    prisma.assetBinding.groupBy({
      by: ['status'],
      where: {
        ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
        createdAt: { gte: range.start, lte: range.end },
        iotDeviceId: { not: null }
      },
      _count: { _all: true }
    }),
    prisma.iotDevice.count({
      where: {
        ...byTenantAndDateWhere,
        bindings: {
          none: {
            status: 'ACTIVE',
            endedAt: null
          }
        }
      }
    }),
    prisma.user.count({ where: byTenantAndDateWhere }),
    prisma.user.groupBy({
      by: ['isActive'],
      where: byTenantAndDateWhere,
      _count: { _all: true }
    }),
    prisma.user.groupBy({
      by: ['role'],
      where: byTenantAndDateWhere,
      _count: { _all: true }
    }),
    prisma.order.count({ where: byTenantAndDateWhere }),
    prisma.order.groupBy({
      by: ['status'],
      where: byTenantAndDateWhere,
      _count: { _all: true }
    }),
    prisma.payment.count({ where: byTenantAndDateWhere }),
    prisma.payment.groupBy({
      by: ['status'],
      where: byTenantAndDateWhere,
      _count: { _all: true }
    })
  ])

  return {
    filters: {
      period: query.period,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      tenantIds
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
        key: 'asset_types',
        title: 'Asset Type',
        total: assetTypeGroup.reduce((sum, item) => sum + item._count._all, 0),
        statuses: assetTypeGroup.map(item => ({
          label: item.kind,
          count: item._count._all
        }))
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
