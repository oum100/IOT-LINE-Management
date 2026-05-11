import { getServerSession } from '#auth'
import { prisma } from '../../utils/prisma'
import { assertPermission, isPlatformRole, resolvePortalScopeContext } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.dashboard.read')
  const session = await getServerSession(event)
  const sessionUser = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined

  if (!sessionUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      role: true,
      tenantId: true,
      merchantAccountId: true,
      isActive: true
    }
  })

  if (!dbUser || !dbUser.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'User session is invalid. Please sign in again.' })
  }

  const user = {
    id: dbUser.id,
    role: dbUser.role as Role,
    tenantId: dbUser.tenantId,
    merchantAccountId: dbUser.merchantAccountId
  }

  try {
    const scope = await resolvePortalScopeContext(user)
    const resolvedTenantId = scope.resolvedTenantId

    if (!isPlatformRole(user.role) && !resolvedTenantId && !user.merchantAccountId) {
      throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
    }

    const insightStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const insightEnd = new Date()

    const where = isPlatformRole(user.role)
      ? {}
      : {
          ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
          ...(user.merchantAccountId ? { merchantAccountId: user.merchantAccountId } : {}),
          ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
          ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {})
        }

    const tenant = resolvedTenantId
      ? await prisma.tenant.findUnique({
          where: { id: resolvedTenantId },
          select: { id: true, code: true, name: true }
        })
      : null

    const tenantScope = isPlatformRole(user.role) ? null : (resolvedTenantId || null)
    const merchantScope = isPlatformRole(user.role) ? null : (user.merchantAccountId || null)

    const tenantWhere = tenantScope ? { tenantId: tenantScope } : {}
    const merchantWhere = {
      ...tenantWhere,
      ...(scope.allowedMerchantIds !== null ? { id: { in: scope.allowedMerchantIds } } : {}),
      ...(merchantScope ? { id: merchantScope } : {})
    }
    const branchWhere = {
      ...tenantWhere,
      ...(scope.allowedBranchIds !== null ? { id: { in: scope.allowedBranchIds } } : {}),
      ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
      ...(merchantScope ? { merchantAccountId: merchantScope } : {})
    }
    const assetWhere = {
      ...tenantWhere,
      ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
      ...(merchantScope ? { branch: { merchantAccountId: merchantScope } } : {})
    }
    const merchantIdFilter = merchantScope
      ? [merchantScope]
      : (scope.allowedMerchantIds !== null ? scope.allowedMerchantIds : null)
    const scopedBindingWhere = (merchantIdFilter !== null || scope.allowedBranchIds !== null)
      ? {
          bindings: {
            some: {
              status: 'ACTIVE' as const,
              endedAt: null,
              asset: {
                ...(merchantIdFilter !== null ? { branch: { merchantAccountId: { in: merchantIdFilter } } } : {}),
                ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
              }
            }
          }
        }
      : {}
    const deviceWhere = {
      ...tenantWhere,
      ...scopedBindingWhere
    }
    const machineWhere = {
      ...tenantWhere,
      ...scopedBindingWhere
    }
    const orderWhere = {
      ...where
    }
    const paymentWhere = {
      ...where
    }
    const insightOrderScope = {
      createdAt: { gte: insightStart, lte: insightEnd },
      ...(tenantScope ? { tenantId: tenantScope } : {}),
      ...(merchantScope ? { merchantAccountId: merchantScope } : {}),
      ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
      ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {})
    }

    const [
      merchantTotal,
      merchantActive,
      merchantSuspended,
      merchantDisabled,
      branchTotal,
      branchActive,
      branchSuspended,
      branchDisabled,
      assetTotal,
      assetActive,
      assetMaintenance,
      assetInactive,
      deviceTotal,
      deviceInUse,
      deviceSpare,
      deviceOffline,
      machineTotal,
      machineInUse,
      machineSpare,
      machineOffline,
      orderTotal,
      orderPending,
      orderInProgress,
      orderCompleted,
      paymentTotal,
      expenseTotal,
      topProductGroups,
      topAssetGroups
    ] = await Promise.all([
      prisma.merchantAccount.count({ where: merchantWhere }),
      prisma.merchantAccount.count({ where: { ...merchantWhere, status: 'ACTIVE' } }),
      prisma.merchantAccount.count({ where: { ...merchantWhere, status: 'SUSPENDED' } }),
      prisma.merchantAccount.count({ where: { ...merchantWhere, status: 'DISABLED' } }),
      prisma.branch.count({ where: branchWhere }),
      prisma.branch.count({ where: { ...branchWhere, status: 'ACTIVE' } }),
      prisma.branch.count({ where: { ...branchWhere, status: 'SUSPENDED' } }),
      prisma.branch.count({ where: { ...branchWhere, status: 'DISABLED' } }),
      prisma.asset.count({ where: assetWhere }),
      prisma.asset.count({ where: { ...assetWhere, status: 'ACTIVE' } }),
      prisma.asset.count({ where: { ...assetWhere, status: 'MAINTENANCE' } }),
      prisma.asset.count({ where: { ...assetWhere, status: 'INACTIVE' } }),
      prisma.iotDevice.count({ where: deviceWhere }),
      prisma.iotDevice.count({ where: { ...deviceWhere, status: 'BOUND' } }),
      prisma.iotDevice.count({ where: { ...deviceWhere, status: 'SPARE' } }),
      prisma.iotDevice.count({ where: { ...deviceWhere, status: 'OFFLINE' } }),
      prisma.machine.count({ where: machineWhere }),
      prisma.machine.count({ where: { ...machineWhere, status: 'BOUND' } }),
      prisma.machine.count({ where: { ...machineWhere, status: 'SPARE' } }),
      prisma.machine.count({ where: { ...machineWhere, status: 'OFFLINE' } }),
      prisma.order.count({ where: orderWhere }),
      prisma.order.count({ where: { ...orderWhere, status: 'PENDING_PAYMENT' } }),
      prisma.order.count({ where: { ...orderWhere, status: 'IN_PROGRESS' } }),
      prisma.order.count({ where: { ...orderWhere, status: 'COMPLETED' } }),
      prisma.payment.count({ where: paymentWhere }),
      prisma.expense.aggregate({
        where: {
          ...(tenantScope ? { tenantId: tenantScope } : {}),
          ...(merchantScope ? { merchantAccountId: merchantScope } : {}),
          occurredAt: { gte: insightStart, lte: insightEnd }
        },
        _sum: { amount: true }
      }),
      prisma.orderItem.groupBy({
        by: ['priceLabel'],
        where: {
          order: { is: insightOrderScope }
        },
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5
      }),
      prisma.orderItem.groupBy({
        by: ['assetId'],
        where: {
          order: { is: insightOrderScope }
        },
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { _count: { assetId: 'desc' } },
        take: 5
      })
    ])

    const topAssetIds = topAssetGroups.map(item => item.assetId).filter((id): id is string => Boolean(id))
    const topAssetInfos = topAssetIds.length
      ? await prisma.asset.findMany({
          where: { id: { in: topAssetIds } },
          select: { id: true, code: true, name: true }
        })
      : []
    const topAssetInfoMap = new Map(topAssetInfos.map(item => [item.id, item]))

    return {
      scope: isPlatformRole(user.role) ? 'platform' : 'tenant',
      tenant,
      order: {
        total: orderTotal,
        pendingPayment: orderPending,
        inProgress: orderInProgress,
        completed: orderCompleted
      },
      payment: {
        total: paymentTotal
      },
      expense: {
        total: Number(expenseTotal._sum.amount || 0)
      },
      merchant: {
        total: merchantTotal,
        active: merchantActive,
        suspended: merchantSuspended,
        disabled: merchantDisabled
      },
      branch: {
        total: branchTotal,
        active: branchActive,
        suspended: branchSuspended,
        disabled: branchDisabled
      },
      asset: {
        total: assetTotal,
        active: assetActive,
        maintenance: assetMaintenance,
        disabled: assetInactive
      },
      device: {
        total: deviceTotal,
        active: deviceInUse + deviceSpare,
        inUse: deviceInUse,
        spare: deviceSpare,
        offline: deviceOffline
      },
      machine: {
        total: machineTotal,
        active: machineInUse + machineSpare,
        inUse: machineInUse,
        spare: machineSpare,
        offline: machineOffline
      },
      insight: {
        start: insightStart.toISOString(),
        end: insightEnd.toISOString(),
        topProducts: topProductGroups.map((item) => ({
          id: item.priceLabel,
          label: item.priceLabel,
          revenue: Number(item._sum.amount || 0),
          useCount: Number(item._count._all || 0)
        })),
        topAssets: topAssetGroups
          .map((item) => {
            if (!item.assetId) return null
            const asset = topAssetInfoMap.get(item.assetId)
            return {
              id: item.assetId,
              label: asset ? `${asset.code} (${asset.name})` : item.assetId,
              revenue: Number(item._sum.amount || 0),
              useCount: Number(item._count._all || 0)
            }
          })
          .filter((item): item is { id: string; label: string; revenue: number; useCount: number } => Boolean(item))
      }
    }
  } catch (error) {
    console.error('[app/dashboard] failed:', error)
    return {
      scope: isPlatformRole(user.role) ? 'platform' : 'tenant',
      tenant: null,
      order: { total: 0, pendingPayment: 0, inProgress: 0, completed: 0 },
      payment: { total: 0 },
      expense: { total: 0 },
      merchant: { total: 0, active: 0, suspended: 0, disabled: 0 },
      branch: { total: 0, active: 0, suspended: 0, disabled: 0 },
      asset: { total: 0, active: 0, maintenance: 0, disabled: 0 },
      device: { total: 0, active: 0, inUse: 0, spare: 0, offline: 0 },
      machine: { total: 0, active: 0, inUse: 0, spare: 0, offline: 0 },
      insight: {
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        topProducts: [],
        topAssets: []
      }
    }
  }
})
