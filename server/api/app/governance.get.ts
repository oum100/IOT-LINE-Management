import { getServerSession } from '#auth'
import { prisma } from '../../utils/prisma'
import { resolvePaymentExpiryMinutes } from '../../utils/payment-expiry'
import { assertPermission, normalizeRole, resolvePortalScopeContext } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.governance.read')
  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId
  const normalizedRole = normalizeRole(user.role)

  if (!resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }

  const userScopeWhere = (() => {
    const base = { tenantId: resolvedTenantId } as Record<string, unknown>
    if (normalizedRole !== 'MANAGER' && normalizedRole !== 'STAFF') return base

    const or: Array<Record<string, unknown>> = [{ id: user.id }]
    if (scope.allowedMerchantIds !== null && scope.allowedMerchantIds.length) {
      or.push({ merchantAccountId: { in: scope.allowedMerchantIds } })
      or.push({
        scopeAssignments: {
          some: {
            active: true,
            scopeType: 'MERCHANT',
            merchantAccountId: { in: scope.allowedMerchantIds }
          }
        }
      })
    }
    if (scope.allowedBranchIds !== null && scope.allowedBranchIds.length) {
      or.push({
        scopeAssignments: {
          some: {
            active: true,
            scopeType: 'BRANCH',
            branchId: { in: scope.allowedBranchIds }
          }
        }
      })
    }
    return { ...base, OR: or }
  })()

  const orm = prisma as any
  const [users, billers, paymentExpiryMinutes] = await Promise.all([
    prisma.user.findMany({
      where: userScopeWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        merchantAccountId: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        merchantAccount: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        scopeAssignments: {
          where: { active: true },
          select: {
            scopeType: true,
            merchantAccountId: true,
            branchId: true
          }
        }
      }
    }),
    orm.billerProfile.findMany({
      where: { tenantId: resolvedTenantId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 30,
      select: {
        id: true,
        code: true,
        displayName: true,
        providerCode: true,
        integrationMode: true,
        status: true,
        priority: true,
        billerId: true,
        providerConnectionId: true,
        slipVerifyConnectionId: true,
        config: true,
        providerConnection: {
          select: {
            id: true,
            code: true,
            displayName: true,
            providerCode: true,
            status: true
          }
        },
        slipVerifyConnection: {
          select: {
            id: true,
            code: true,
            displayName: true,
            providerCode: true,
            status: true
          }
        },
        _count: {
          select: {
            payments: true,
            tenantBindings: true,
            merchantBindings: true,
            branchBindings: true
          }
        }
      }
    }),
    resolvePaymentExpiryMinutes(event)
  ])

  const billersWithDelete = billers.map((item: any) => {
    const linkedCount = item._count.payments + item._count.tenantBindings + item._count.merchantBindings + item._count.branchBindings
    const config = ((item.config as Record<string, unknown> | null) || {})
    return {
      id: item.id,
      code: item.code,
      displayName: item.displayName,
      providerCode: item.providerCode,
      integrationMode: item.integrationMode,
      status: item.status,
      priority: item.priority,
      billerId: item.billerId,
      providerConnectionId: item.providerConnectionId || null,
      providerConnectionName: item.providerConnection?.displayName || null,
      qrPaymentMode: typeof config.qrPaymentMode === 'string' ? config.qrPaymentMode : null,
      maeManeeReferencePrefix: typeof config.maeManeeReferencePrefix === 'string' ? config.maeManeeReferencePrefix : null,
      maeManeeShopId: typeof config.maeManeeShopId === 'string' ? config.maeManeeShopId : null,
      slipVerifyConnectionId: item.slipVerifyConnectionId || null,
      slipVerificationProvider: item.slipVerifyConnection?.displayName || item.slipVerifyConnection?.providerCode || (typeof config.slipVerificationProvider === 'string' ? config.slipVerificationProvider : null),
      merchantBindingCount: item._count.merchantBindings,
      branchBindingCount: item._count.branchBindings,
      linkedCount,
      canDelete: linkedCount === 0
    }
  })

  return {
    users,
    billers: billersWithDelete,
    paymentExpiryMinutes
  }
})
