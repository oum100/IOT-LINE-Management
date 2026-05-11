import { getServerSession } from '#auth'
import { getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { assertPermission, isPlatformRole, resolvePortalScopeContext } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'
type Tab = 'current' | 'upcoming' | 'history'

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: Role; tenantId?: string | null; merchantAccountId?: string | null } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId
  if (!isPlatformRole(user.role) && !resolvedTenantId) throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  const query = getQuery(event)
  const tab = String(query.tab || 'current') as Tab
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
  if (scope.allowedBranchIds !== null) assetWhere.branchId = { in: scope.allowedBranchIds }
  if (scope.allowedMerchantIds !== null) assetWhere.branch = { merchantAccountId: { in: scope.allowedMerchantIds } }
  if (merchantAccountId) assetWhere.branch = { merchantAccountId }
  if (branchId) assetWhere.branchId = branchId

  const baseWhere = {
    tenantId: resolvedTenantId,
    ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {}),
    ...(type ? { product: { kind: type } } : {})
  } as const

  const where = {
    ...baseWhere,
    ...tabWhere
  } as const

  const [items, total, productListRaw, productBindings, tenant, merchants, branches, types] = await Promise.all([
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
        tenantId: resolvedTenantId,
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
    prisma.assetProductPrice.findMany({
      where: {
        tenantId: resolvedTenantId,
        active: true,
        ...(type ? { product: { kind: type } } : {}),
        ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {})
      },
      select: {
        productId: true,
        asset: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            branch: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [{ productId: 'asc' }, { asset: { name: 'asc' } }],
      take: 5000
    }),
    prisma.tenant.findUnique({
      where: { id: resolvedTenantId },
      select: { id: true, code: true, name: true }
    }),
    prisma.merchantAccount.findMany({
      where: {
        tenantId: resolvedTenantId,
        ...(scope.allowedMerchantIds !== null ? { id: { in: scope.allowedMerchantIds } } : {})
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
      take: 200
    }),
    prisma.branch.findMany({
      where: {
        tenantId: resolvedTenantId,
        ...(scope.allowedBranchIds !== null ? { id: { in: scope.allowedBranchIds } } : {}),
        ...(merchantAccountId ? { merchantAccountId } : {}),
        ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {})
      },
      select: { id: true, code: true, name: true, merchantAccountId: true },
      orderBy: { name: 'asc' },
      take: 200
    }),
    prisma.product.findMany({
      where: { tenantId: resolvedTenantId },
      select: { kind: true },
      distinct: ['kind'],
      orderBy: { kind: 'asc' },
      take: 200
    })
  ])

  const allowedMerchantIds = new Set(merchants.map(item => item.id))
  const allowedBranchIds = new Set(branches.map(item => item.id))
  if (merchantAccountId && !allowedMerchantIds.has(merchantAccountId)) {
    throw createError({ statusCode: 403, statusMessage: 'Merchant out of scope' })
  }
  if (branchId && !allowedBranchIds.has(branchId)) {
    throw createError({ statusCode: 403, statusMessage: 'Branch out of scope' })
  }

  const productBindingMap = new Map<string, Array<{
    assetId: string
    assetCode: string
    assetName: string
    assetStatus: string
    branchId: string | null
    branchCode: string | null
    branchName: string | null
  }>>()
  for (const item of productBindings) {
    if (!item.productId || !item.asset) continue
    const list = productBindingMap.get(item.productId) || []
    list.push({
      assetId: item.asset.id,
      assetCode: item.asset.code,
      assetName: item.asset.name,
      assetStatus: item.asset.status,
      branchId: item.asset.branch?.id || null,
      branchCode: item.asset.branch?.code || null,
      branchName: item.asset.branch?.name || null
    })
    productBindingMap.set(item.productId, list)
  }

  const productMap = new Map<string, {
    id: string
    code: string
    name: string
    kind: string
    amount: number
    quantity: string
    active: boolean
    bindings: number
    bindingAssets: Array<{
      assetId: string
      assetCode: string
      assetName: string
      assetStatus: string
      branchId: string | null
      branchCode: string | null
      branchName: string | null
    }>
  }>()
  for (const p of productListRaw) {
    if (!p?.id || productMap.has(p.id)) continue
    const bindingAssets = productBindingMap.get(p.id) || []
    productMap.set(p.id, {
      id: p.id,
      code: p.code,
      name: p.name,
      kind: p.kind,
      amount: Number(p.amount || 0),
      quantity: `${p.quantity ?? p.durationMinutes ?? '-'} ${String(p.serviceUnit || 'UNIT').toLowerCase()}`,
      active: Boolean(p.active),
      bindings: bindingAssets.length,
      bindingAssets
    })
  }

  return {
    items,
    total,
    page,
    pageSize,
    productList: Array.from(productMap.values()),
    options: {
      tenants: tenant ? [tenant] : [],
      merchants,
      branches,
      types: types.map(i => i.kind)
    }
  }
})
