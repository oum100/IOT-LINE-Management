import { getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { assertAdminAccess } from '../../utils/admin-auth'

type Tab = 'current' | 'upcoming' | 'history'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)

  const tab = String(query.tab || 'current') as Tab
  const tenantId = String(query.tenantId || '').trim()
  const merchantAccountId = String(query.merchantAccountId || '').trim()
  const branchId = String(query.branchId || '').trim()
  const type = String(query.type || '').trim()
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize || 20)))

  const now = new Date()
  const pausedReasons = [
    'paused-by-admin',
    'paused-by-admin-branch',
    'paused-by-portal',
    'paused-by-portal-branch',
    'portal-manual-pause'
  ]
  const tabWhere = tab === 'current'
    ? {
        OR: [
          {
            active: true,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
          },
          {
            active: false,
            reason: { in: pausedReasons },
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
          }
        ]
      }
    : tab === 'upcoming'
      ? {
          OR: [
            { active: true, effectiveFrom: { gt: now } },
            { active: false, effectiveFrom: { gt: now }, reason: { in: pausedReasons } }
          ]
        }
      : {
          OR: [
            {
              active: false,
              NOT: {
                OR: [
                  { reason: { in: pausedReasons }, effectiveFrom: { gt: now } },
                  { reason: { in: pausedReasons }, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }
                ]
              }
            },
            { effectiveTo: { lt: now } }
          ]
        }

  const assetWhere: Record<string, unknown> = {}
  if (branchId) assetWhere.branchId = branchId
  else if (merchantAccountId) assetWhere.branch = { merchantAccountId }

  const baseWhere = {
    ...(tenantId ? { tenantId } : {}),
    ...(type ? { product: { kind: type } } : {}),
    ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {})
  } as const

  const where = {
    ...baseWhere,
    ...tabWhere
  } as const

  const [items, total, productListRaw, bindingCounts, tenants, merchants, branches, types] = await Promise.all([
    prisma.assetProductOffer.findMany({
      where,
      select: {
        id: true,
        pricingType: true,
        amount: true,
        priority: true,
        effectiveFrom: true,
        effectiveTo: true,
        updatedAt: true,
        active: true,
        reason: true,
        tenant: { select: { id: true, code: true, name: true } },
        asset: {
          select: {
            id: true,
            code: true,
            name: true,
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                merchantAccount: { select: { id: true, code: true, name: true } }
              }
            }
          }
        },
        product: { select: { id: true, code: true, name: true, kind: true } }
      },
      orderBy: [{ effectiveFrom: 'desc' }, { priority: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.assetProductOffer.count({ where }),
    prisma.product.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(type ? { kind: type } : {})
      },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        amount: true,
        active: true,
        quantity: true,
        durationMinutes: true,
        serviceUnit: true
      },
      orderBy: [{ name: 'asc' }],
      take: 1000
    }),
    prisma.assetProductPrice.groupBy({
      by: ['productId'],
      where: {
        active: true,
        ...(tenantId ? { tenantId } : {}),
        ...(type ? { product: { kind: type } } : {}),
        ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {})
      },
      _count: { _all: true }
    }),
    prisma.tenant.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: 'asc' }, take: 200 }),
    prisma.merchantAccount.findMany({
      where: tenantId ? { tenantId } : undefined,
      select: { id: true, code: true, name: true, tenantId: true },
      orderBy: { name: 'asc' },
      take: 200
    }),
    prisma.branch.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(merchantAccountId ? { merchantAccountId } : {})
      },
      select: { id: true, code: true, name: true, merchantAccountId: true, tenantId: true },
      orderBy: { name: 'asc' },
      take: 200
    }),
    prisma.product.findMany({
      where: tenantId ? { tenantId } : undefined,
      select: { kind: true },
      distinct: ['kind'],
      orderBy: { kind: 'asc' },
      take: 200
    })
  ])

  const bindingCountMap = new Map<string, number>()
  for (const item of bindingCounts) {
    bindingCountMap.set(item.productId, Number(item._count?._all || 0))
  }

  const productMap = new Map<string, { id: string; code: string; name: string; kind: string; amount: number; quantity: string; active: boolean; bindings: number }>()
  for (const p of productListRaw) {
    if (!p?.id || productMap.has(p.id)) continue
    productMap.set(p.id, {
      id: p.id,
      code: p.code,
      name: p.name,
      kind: p.kind,
      amount: Number(p.amount || 0),
      quantity: `${p.quantity ?? p.durationMinutes ?? '-'} ${String(p.serviceUnit || 'UNIT').toLowerCase()}`,
      active: Boolean(p.active),
      bindings: Number(bindingCountMap.get(p.id) || 0)
    })
  }

  return {
    items,
    total,
    page,
    pageSize,
    productList: Array.from(productMap.values()),
    options: {
      tenants,
      merchants,
      branches,
      types: types.map(i => i.kind)
    }
  }
})
