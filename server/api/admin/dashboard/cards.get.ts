import { z } from 'zod'
import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertPermission } from '../../../utils/rbac'

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

function withDefaultStatuses(
  group: Array<{ status: string; _count: { _all: number } }>,
  defaults: string[]
) {
  const map = new Map(group.map(item => [item.status, item._count._all]))
  const defaultSet = new Set(defaults)
  const normalized = defaults.map(status => ({
    label: status,
    count: map.get(status) || 0
  }))
  const extras = group
    .filter(item => !defaultSet.has(item.status))
    .map(item => ({
      label: item.status,
      count: item._count._all
    }))
  return [...normalized, ...extras]
}

function withDefaultLabelCounts(
  items: Array<{ label: string; count: number }>,
  defaults: string[]
) {
  const map = new Map(items.map(item => [item.label, item.count]))
  const defaultSet = new Set(defaults)
  const normalized = defaults.map(label => ({
    label,
    count: map.get(label) || 0
  }))
  const extras = items.filter(item => !defaultSet.has(item.label))
  return [...normalized, ...extras]
}

const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'DISABLED']
const MERCHANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'DISABLED']
const BRANCH_STATUSES = ['ACTIVE', 'SUSPENDED', 'DISABLED']
const ASSET_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE']
const ASSET_TYPE_STATUSES = ['WASHER', 'DRYER', 'WATER', 'VENDING']
const DEVICE_BINDING_STATUSES = ['BIND_ACTIVE', 'BIND_INACTIVE', 'UNBOUND']
const MACHINE_STATUSES = ['SPARE', 'BOUND', 'OFFLINE', 'DISABLED']
const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE']
const ORDER_STATUSES = ['PENDING_PAYMENT', 'SLIP_UPLOADED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
const PAYMENT_STATUSES = ['PENDING', 'SLIP_UPLOADED', 'VERIFIED', 'REJECTED']
const EXPENSE_TYPE_DEFAULTS = ['ELEC', 'WATER', 'RENT', 'STAFF']

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'platform.dashboard.read')

  const query = querySchema.parse(getQuery(event))
  const tenantIds = parseTenantIds(query.tenantIds)
  const tenantIdFilter = tenantIds.length ? { in: tenantIds } : undefined
  const range = getRange(query.period, query.start, query.end)

  try {
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
      machineTotal,
      machineInUseCount,
      machineSpareCount,
      productTotal,
      productActiveGroup,
      userTotal,
      userActiveGroup,
      userRoleGroup,
      orderTotal,
      orderStatus,
      paymentTotal,
      paymentStatus,
      expenseTotal,
      expenseTypeGroup
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
      prisma.machine.count({ where: byTenantAndDateWhere }),
      prisma.machine.count({
        where: {
          ...byTenantAndDateWhere,
          bindings: {
            some: {
              status: 'ACTIVE',
              endedAt: null
            }
          }
        }
      }),
      prisma.machine.count({
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
      prisma.product.count({ where: byTenantAndDateWhere }),
      prisma.product.groupBy({
        by: ['active'],
        where: byTenantAndDateWhere,
        _count: { _all: true }
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
      }),
      prisma.expense.aggregate({
        where: {
          ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
          occurredAt: { gte: range.start, lte: range.end }
        },
        _sum: { amount: true }
      }),
      prisma.expense.groupBy({
        by: ['expenseTypeId'],
        where: {
          ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
          occurredAt: { gte: range.start, lte: range.end }
        },
        _sum: { amount: true }
      })
    ])

    const expenseTypeIds = expenseTypeGroup.map(item => item.expenseTypeId)
    const expenseTypes = expenseTypeIds.length
      ? await prisma.expenseType.findMany({
          where: { id: { in: expenseTypeIds } },
          select: { id: true, code: true, name: true }
        })
      : []
    const expenseTypeMap = new Map(expenseTypes.map(item => [item.id, item]))

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
        statuses: withDefaultStatuses(tenantStatus.map(item => ({ status: item.status, _count: item._count })), TENANT_STATUSES)
      },
      {
        key: 'merchants',
        title: 'Merchants',
        total: merchantTotal,
        statuses: withDefaultStatuses(merchantStatus.map(item => ({ status: item.status, _count: item._count })), MERCHANT_STATUSES)
      },
      {
        key: 'branches',
        title: 'Branches',
        total: branchTotal,
        statuses: withDefaultStatuses(branchStatus.map(item => ({ status: item.status, _count: item._count })), BRANCH_STATUSES)
      },
      {
        key: 'assets',
        title: 'Assets',
        total: assetTotal,
        statuses: withDefaultStatuses(assetStatus.map(item => ({ status: item.status, _count: item._count })), ASSET_STATUSES)
      },
      {
        key: 'asset_types',
        title: 'Asset Type',
        total: assetTypeGroup.reduce((sum, item) => sum + item._count._all, 0),
        statuses: withDefaultLabelCounts(
          assetTypeGroup.map(item => ({
            label: item.kind,
            count: item._count._all
          })),
          ASSET_TYPE_STATUSES
        )
      },
      {
        key: 'devices',
        title: 'Devices',
        total: deviceTotal,
        statuses: withDefaultLabelCounts(
          [
            ...toBreakdown(deviceBindingStatus.map(item => ({ status: `BIND_${item.status}`, _count: item._count }))),
            { label: 'UNBOUND', count: unboundDeviceCount }
          ],
          DEVICE_BINDING_STATUSES
        )
      },
      {
        key: 'machines',
        title: 'Machines',
        total: machineTotal,
        statuses: withDefaultLabelCounts(
          [
            { label: 'BOUND', count: machineInUseCount },
            { label: 'SPARE', count: machineSpareCount },
            { label: 'OFFLINE', count: 0 },
            { label: 'DISABLED', count: 0 }
          ],
          MACHINE_STATUSES
        )
      },
      {
        key: 'products',
        title: 'Products',
        total: productTotal,
        statuses: withDefaultLabelCounts(
          productActiveGroup.map(item => ({
            label: item.active ? 'ACTIVE' : 'INACTIVE',
            count: item._count._all
          })),
          PRODUCT_STATUSES
        )
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
        statuses: withDefaultStatuses(orderStatus.map(item => ({ status: item.status, _count: item._count })), ORDER_STATUSES)
      },
      {
        key: 'payments',
        title: 'Payments',
        total: paymentTotal,
        statuses: withDefaultStatuses(paymentStatus.map(item => ({ status: item.status, _count: item._count })), PAYMENT_STATUSES)
      },
      {
        key: 'expenses',
        title: 'Expenses',
        total: Number(expenseTotal._sum.amount || 0),
        statuses: withDefaultLabelCounts(
          expenseTypeGroup.map(item => {
            const type = expenseTypeMap.get(item.expenseTypeId)
            return {
              label: type?.code || type?.name || item.expenseTypeId,
              count: Number(item._sum.amount || 0)
            }
          }),
          EXPENSE_TYPE_DEFAULTS
        )
      }
      ]
    }
  } catch (err) {
    console.error('[dashboard/cards] failed:', err)
    return {
      filters: {
        period: query.period,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        tenantIds
      },
      cards: []
    }
  }
})
