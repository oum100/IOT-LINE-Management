import { getServerSession } from '#auth'
import { getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { assertAnyPermission, resolvePortalScopeContext } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

function pricingTypeRank(type: string) {
  if (type === 'PROMOTION') return 0
  if (type === 'SPECIAL') return 1
  return 2
}

export default defineEventHandler(async (event) => {
  await assertAnyPermission(event, [
    'portal.asset.read',
    'portal.asset.manage.global',
    'portal.asset.manage.scoped'
  ])
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

  const query = getQuery(event)
  const queryMerchantId = String(query.merchantAccountId || '').trim()
  const queryBranchId = String(query.branchId || '').trim()
  const queryAssetType = String(query.assetType || '').trim()
  const queryAssetId = String(query.assetId || '').trim()

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId

  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }

  const tenant = resolvedTenantId
    ? await prisma.tenant.findUnique({
        where: { id: resolvedTenantId },
        select: { id: true, code: true, name: true }
      })
    : null

  const merchantWhere = {
    ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
    ...(scope.allowedMerchantIds !== null ? { id: { in: scope.allowedMerchantIds } } : {}),
    ...(queryMerchantId ? { id: queryMerchantId } : {}),
    ...(user.merchantAccountId ? { id: user.merchantAccountId } : {})
  }

  const merchants = await prisma.merchantAccount.findMany({
    where: merchantWhere,
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      environment: true,
      updatedAt: true,
      _count: {
        select: {
          orders: true
        }
      }
    },
    orderBy: { name: 'asc' }
  })
  const merchantsWithDelete = merchants.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    status: item.status,
    environment: item.environment,
    updatedAt: item.updatedAt,
    orderCount: item._count.orders,
    canDelete: item._count.orders === 0
  }))

  const allowedMerchantIds = new Set(merchantsWithDelete.map(item => item.id))
  const selectedMerchantId = queryMerchantId && allowedMerchantIds.has(queryMerchantId) ? queryMerchantId : ''

  const branches = await prisma.branch.findMany({
    where: {
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
      ...(scope.allowedBranchIds !== null ? { id: { in: scope.allowedBranchIds } } : {}),
      ...(selectedMerchantId ? { merchantAccountId: selectedMerchantId } : {}),
      ...(queryBranchId ? { id: queryBranchId } : {})
    },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      merchantAccountId: true,
      updatedAt: true,
      _count: {
        select: {
          orders: true
        }
      }
    },
    orderBy: { name: 'asc' }
  })
  const branchesWithDelete = branches.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    status: item.status,
    merchantAccountId: item.merchantAccountId,
    updatedAt: item.updatedAt,
    orderCount: item._count.orders,
    canDelete: item._count.orders === 0
  }))

  const allowedBranchIds = new Set(branchesWithDelete.map(item => item.id))
  const selectedBranchId = queryBranchId && allowedBranchIds.has(queryBranchId) ? queryBranchId : ''

  const assets = await prisma.asset.findMany({
    where: {
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
      ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      ...(selectedMerchantId && !selectedBranchId ? { branch: { merchantAccountId: selectedMerchantId } } : {}),
      ...(queryAssetType ? { kind: queryAssetType } : {})
    },
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      status: true,
      branchId: true,
      updatedAt: true
      ,
      prices: {
        where: { active: true },
        select: { id: true },
        take: 1
      },
      bindings: {
        where: {
          status: 'ACTIVE',
          endedAt: null
        },
        select: {
          iotDeviceId: true,
          machineId: true
        },
        take: 1
      }
    },
    orderBy: { name: 'asc' },
    take: 200
  })

  const productsRaw = await prisma.product.findMany({
    where: {
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      ...(queryAssetType ? { kind: queryAssetType } : {})
    },
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      amount: true,
      durationMinutes: true,
      active: true,
      updatedAt: true
    },
    orderBy: { name: 'asc' },
    take: 200
  })

  const lockedProductRows = resolvedTenantId
    ? await prisma.$queryRaw<Array<{ productId: string }>>`
      SELECT DISTINCT app."productId"
      FROM "asset_product_prices" app
      JOIN "OrderItem" oi ON oi."assetId" = app."assetId"
      WHERE app."tenantId" = ${resolvedTenantId}
        AND oi."status" = 'COMPLETED'
    `
    : []

  const lockedProductIds = new Set(lockedProductRows.map(item => item.productId))
  const products = productsRaw.map(item => ({
    ...item,
    locked: lockedProductIds.has(item.id)
  }))

  const assetsWithReadiness = assets.map((item) => {
    const activeBinding = item.bindings[0] || null
    const hasDevice = Boolean(activeBinding?.iotDeviceId)
    const hasMachine = Boolean(activeBinding?.machineId)
    const hasProduct = (item.prices?.length || 0) > 0
    const readiness = !hasDevice
      ? 'MISSING_DEVICE'
      : !hasMachine
        ? 'MISSING_MACHINE'
        : !hasProduct
          ? 'MISSING_PRODUCT'
          : 'READY'

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      kind: item.kind,
      status: item.status,
      branchId: item.branchId,
      updatedAt: item.updatedAt,
      readiness
    }
  })

  const devices = await prisma.iotDevice.findMany({
    where: {
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      ...(selectedMerchantId || selectedBranchId
        ? {
            bindings: {
              some: {
                status: 'ACTIVE',
                endedAt: null,
                asset: {
                  ...(selectedMerchantId
                    ? {
                        branch: {
                          merchantAccountId: selectedMerchantId
                        }
                      }
                    : {}),
                  ...(selectedBranchId ? { branchId: selectedBranchId } : {})
                }
              }
            }
          }
        : {})
    },
    select: {
      id: true,
      deviceUid: true,
      macAddress: true,
      status: true,
      fwVersion: true,
      name: true,
      model: true,
      _count: {
        select: {
          bindings: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  })
  const devicesWithDelete = devices.map((item) => ({
    id: item.id,
    deviceUid: item.deviceUid,
    macAddress: item.macAddress,
    status: item.status,
    fwVersion: item.fwVersion,
    name: item.name,
    model: item.model,
    canDelete: item.status === 'SPARE' && item._count.bindings === 0
  }))

  const machines = await prisma.machine.findMany({
    where: {
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      ...(selectedMerchantId || selectedBranchId
        ? {
            bindings: {
              some: {
                status: 'ACTIVE',
                endedAt: null,
                asset: {
                  ...(selectedMerchantId
                    ? {
                        branch: {
                          merchantAccountId: selectedMerchantId
                        }
                      }
                    : {}),
                  ...(selectedBranchId ? { branchId: selectedBranchId } : {})
                }
              }
            }
          }
        : {})
    },
    select: {
      id: true,
      serialNo: true,
      brand: true,
      model: true,
      status: true,
      _count: {
        select: {
          bindings: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  })
  const machinesWithDelete = machines.map((item) => ({
    id: item.id,
    serialNo: item.serialNo,
    brand: item.brand,
    model: item.model,
    status: item.status,
    canDelete: item.status === 'SPARE' && item._count.bindings === 0
  }))

  const machineKindsRaw = await prisma.machineKind.findMany({
    select: {
      code: true,
      name: true,
      active: true,
      _count: {
        select: {
          assets: true,
          products: true,
          machines: true
        }
      }
    },
    orderBy: [
      { sortOrder: 'asc' },
      { code: 'asc' }
    ]
  })
  const machineKinds = machineKindsRaw.map(item => ({
    code: item.code,
    name: item.name,
    active: item.active,
    canDelete: item._count.assets === 0 && item._count.products === 0 && item._count.machines === 0
  }))
  const selectedAssetId = queryAssetId && assets.some(item => item.id === queryAssetId)
    ? queryAssetId
    : (assets[0]?.id || '')

  const selectedAsset = selectedAssetId
    ? await prisma.asset.findUnique({
        where: { id: selectedAssetId },
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
          status: true,
          updatedAt: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
              merchantAccount: {
                select: { id: true, name: true, code: true }
              }
            }
          },
          prices: {
            select: {
              id: true,
              amount: true,
              durationMinutes: true,
              serviceMode: true,
              serviceUnit: true,
              quantity: true,
              sortOrder: true,
              active: true,
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  active: true,
                  amount: true,
                  durationMinutes: true,
                  serviceMode: true,
                  serviceUnit: true,
                  quantity: true
                }
              }
            },
            orderBy: [
              { sortOrder: 'asc' },
              { amount: 'asc' }
            ]
          }
        }
      })
    : null

  const bindingUsageRows = selectedAssetId
    ? await prisma.$queryRaw<Array<{ priceId: string; orderCount: number }>>`
      SELECT
        app."id" AS "priceId",
        COUNT(oi."id")::int AS "orderCount"
      FROM "asset_product_prices" app
      LEFT JOIN "OrderItem" oi
        ON oi."assetId" = app."assetId"
       AND oi."amount" = app."amount"
       AND oi."durationMinutes" = app."durationMinutes"
      WHERE app."assetId" = ${selectedAssetId}
      GROUP BY app."id"
    `
    : []

  const usageByPriceId = new Map(bindingUsageRows.map(row => [row.priceId, Number(row.orderCount || 0)]))
  const activeOrUpcomingOffers = selectedAssetId
    ? await prisma.assetProductOffer.findMany({
        where: {
          tenantId: resolvedTenantId || undefined,
          assetId: selectedAssetId,
          active: true,
          OR: [
            {
              AND: [
                { effectiveFrom: { lte: new Date() } },
                {
                  OR: [
                    { effectiveTo: null },
                    { effectiveTo: { gte: new Date() } }
                  ]
                }
              ]
            },
            { effectiveFrom: { gt: new Date() } }
          ]
        },
        select: {
          id: true,
          productId: true,
          pricingType: true,
          amount: true,
          durationMinutes: true,
          serviceMode: true,
          serviceUnit: true,
          quantity: true,
          priority: true,
          effectiveFrom: true,
          effectiveTo: true,
          reason: true,
          product: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { priority: 'asc' },
          { effectiveFrom: 'desc' }
        ]
      })
    : []
  const currentOfferByProductId = new Map<string, (typeof activeOrUpcomingOffers)[number]>()
  const upcomingOfferByProductId = new Map<string, (typeof activeOrUpcomingOffers)[number]>()
  const currentOfferByProductName = new Map<string, (typeof activeOrUpcomingOffers)[number]>()
  const upcomingOfferByProductName = new Map<string, (typeof activeOrUpcomingOffers)[number]>()
  const pausedOffers = selectedAssetId
    ? await prisma.assetProductOffer.findMany({
        where: {
          tenantId: resolvedTenantId || undefined,
          assetId: selectedAssetId,
          pricingType: 'PROMOTION',
          active: false,
          reason: {
            in: [
              'portal-manual-pause',
              'paused-by-portal',
              'paused-by-portal-branch',
              'paused-by-admin',
              'paused-by-admin-branch'
            ]
          },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }]
        },
        select: {
          id: true,
          productId: true,
          pricingType: true,
          amount: true,
          durationMinutes: true,
          serviceMode: true,
          serviceUnit: true,
          quantity: true,
          priority: true,
          effectiveFrom: true,
          effectiveTo: true,
          reason: true,
          product: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ effectiveFrom: 'desc' }]
      })
    : []
  const pausedOfferByProductId = new Map<string, (typeof pausedOffers)[number]>()
  const pausedOfferByProductName = new Map<string, (typeof pausedOffers)[number]>()
  for (const item of pausedOffers) {
    if (!pausedOfferByProductId.has(item.productId)) pausedOfferByProductId.set(item.productId, item)
    const nameKey = String(item.product?.name || '').trim().toLowerCase()
    if (nameKey && !pausedOfferByProductName.has(nameKey)) pausedOfferByProductName.set(nameKey, item)
  }
  const now = new Date()
  for (const item of activeOrUpcomingOffers) {
    const isCurrent = item.effectiveFrom <= now && (!item.effectiveTo || item.effectiveTo >= now)
    const targetMap = isCurrent ? currentOfferByProductId : upcomingOfferByProductId
    const targetNameMap = isCurrent ? currentOfferByProductName : upcomingOfferByProductName
    const existing = targetMap.get(item.productId)
    if (!existing) {
      targetMap.set(item.productId, item)
      const nameKey = String(item.product?.name || '').trim().toLowerCase()
      if (nameKey && !targetNameMap.has(nameKey)) {
        targetNameMap.set(nameKey, item)
      }
      continue
    }
    const priorityDiff = item.priority - existing.priority
    if (priorityDiff < 0) {
      targetMap.set(item.productId, item)
      const nameKey = String(item.product?.name || '').trim().toLowerCase()
      if (nameKey) targetNameMap.set(nameKey, item)
      continue
    }
    if (priorityDiff === 0 && pricingTypeRank(item.pricingType) < pricingTypeRank(existing.pricingType)) {
      targetMap.set(item.productId, item)
      const nameKey = String(item.product?.name || '').trim().toLowerCase()
      if (nameKey) targetNameMap.set(nameKey, item)
    }
  }
  const selectedAssetWithUsage = selectedAsset
    ? {
        ...selectedAsset,
        prices: selectedAsset.prices.map(item => {
          const orderCount = usageByPriceId.get(item.id) || 0
          const nameKey = String(item.product?.name || '').trim().toLowerCase()
          const currentOffer = item.product?.id
            ? (currentOfferByProductId.get(item.product.id) || (nameKey ? currentOfferByProductName.get(nameKey) : null) || null)
            : (nameKey ? currentOfferByProductName.get(nameKey) || null : null)
          const upcomingOffer = item.product?.id
            ? (upcomingOfferByProductId.get(item.product.id) || (nameKey ? upcomingOfferByProductName.get(nameKey) : null) || null)
            : (nameKey ? upcomingOfferByProductName.get(nameKey) || null : null)
          const pausedOffer = item.product?.id
            ? (pausedOfferByProductId.get(item.product.id) || (nameKey ? pausedOfferByProductName.get(nameKey) : null) || null)
            : (nameKey ? pausedOfferByProductName.get(nameKey) || null : null)
          return {
            ...item,
            orderCount,
            canUnbind: item.active && orderCount === 0,
            currentOffer,
            upcomingOffer,
            pausedOffer
          }
        })
      }
    : null

  const activeBinding = selectedAssetId
    ? await prisma.assetBinding.findFirst({
        where: {
          assetId: selectedAssetId,
          status: 'ACTIVE'
        },
        select: {
          id: true,
          startedAt: true,
          reason: true,
          iotDevice: {
            select: {
              id: true,
              deviceUid: true,
              macAddress: true,
              name: true,
              model: true,
              status: true,
              fwVersion: true
            }
          },
          machine: {
            select: {
              id: true,
              serialNo: true,
              brand: true,
              model: true,
              status: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })
    : null

  const assetKinds = await prisma.asset.findMany({
    where: {
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      ...(selectedMerchantId && !selectedBranchId ? { branch: { merchantAccountId: selectedMerchantId } } : {})
    },
    select: { kind: true },
    distinct: ['kind'],
    orderBy: { kind: 'asc' }
  })

  return {
    tenant,
    selectedMerchantId,
    selectedBranchId,
    selectedAssetId,
    selectedAssetType: queryAssetType,
    assetTypes: assetKinds.map(item => item.kind),
    merchants: merchantsWithDelete,
    branches: branchesWithDelete,
    assets: assetsWithReadiness,
    devices: devicesWithDelete,
    machines: machinesWithDelete,
    products,
    machineKinds,
    selectedAsset: selectedAssetWithUsage,
    activeBinding
  }
})
