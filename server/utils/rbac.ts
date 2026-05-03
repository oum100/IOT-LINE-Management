import { createError, type H3Event } from 'h3'
import { getServerSession } from '#auth'
import { prisma } from './prisma'

export type AppRole = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

export type AppPermission =
  | 'platform.dashboard.read'
  | 'platform.expense.read'
  | 'platform.order.read'
  | 'platform.order.manage'
  | 'portal.dashboard.read'
  | 'portal.revenue.read'
  | 'portal.expense.read'
  | 'portal.governance.read'
  | 'portal.user.manage'
  | 'portal.merchant.read'
  | 'portal.merchant.manage'
  | 'portal.branch.read'
  | 'portal.branch.manage'
  | 'portal.asset.manage'
  | 'portal.order.manage'
  | 'portal.refund.manage'
  | 'portal.settings.manage'
  | 'portal.expense.manage'

const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  ADMIN: [
    'platform.dashboard.read',
    'platform.expense.read',
    'platform.order.read',
    'platform.order.manage',
    'portal.dashboard.read',
    'portal.revenue.read',
    'portal.expense.read',
    'portal.governance.read',
    'portal.user.manage'
  ],
  USER: [
    'platform.dashboard.read',
    'platform.expense.read',
    'platform.order.read'
  ],
  OWNER: [
    'portal.dashboard.read',
    'portal.revenue.read',
    'portal.expense.read',
    'portal.governance.read',
    'portal.user.manage',
    'portal.merchant.read',
    'portal.merchant.manage',
    'portal.branch.read',
    'portal.branch.manage',
    'portal.asset.manage',
    'portal.order.manage',
    'portal.refund.manage',
    'portal.settings.manage',
    'portal.expense.manage'
  ],
  MANAGER: [
    'portal.dashboard.read',
    'portal.revenue.read',
    'portal.expense.read',
    'portal.governance.read',
    'portal.merchant.read',
    'portal.branch.read',
    'portal.asset.manage',
    'portal.order.manage',
    'portal.refund.manage'
  ],
  STAFF: [
    'portal.dashboard.read',
    'portal.revenue.read',
    'portal.expense.read',
    'portal.governance.read',
    'portal.merchant.read',
    'portal.branch.read',
    'portal.asset.manage',
    'portal.order.manage',
    'portal.refund.manage'
  ]
}

export function normalizeRole(role: string | null | undefined): AppRole | null {
  const normalized = String(role || '').toUpperCase()
  if (normalized === 'ADMIN' || normalized === 'USER' || normalized === 'OWNER' || normalized === 'MANAGER' || normalized === 'STAFF') {
    return normalized
  }
  return null
}

export function isPlatformRole(role: string | null | undefined) {
  const normalized = normalizeRole(role)
  return normalized === 'ADMIN' || normalized === 'USER'
}

export function hasPermission(role: string | null | undefined, permission: AppPermission) {
  const normalized = normalizeRole(role)
  if (!normalized) return false
  return ROLE_PERMISSIONS[normalized].includes(permission)
}

export type SessionUserLike = {
  id?: string
  role?: string
  tenantId?: string | null
  merchantAccountId?: string | null
}

export type PortalScopeContext = {
  resolvedTenantId: string | null
  lockedMerchantId: string | null
  allowedMerchantIds: string[] | null
  allowedBranchIds: string[] | null
}

export async function resolvePortalScopeContext(user: SessionUserLike): Promise<PortalScopeContext> {
  const resolvedTenantId = user.tenantId
    || (user.merchantAccountId
      ? (await prisma.merchantAccount.findUnique({
          where: { id: user.merchantAccountId },
          select: { tenantId: true }
        }))?.tenantId
      : null)

  const lockedMerchantId = isPlatformRole(user.role) ? null : (user.merchantAccountId || null)
  const normalizedRole = normalizeRole(user.role)
  if (normalizedRole !== 'MANAGER' && normalizedRole !== 'STAFF') {
    return {
      resolvedTenantId: resolvedTenantId || null,
      lockedMerchantId,
      allowedMerchantIds: null,
      allowedBranchIds: null
    }
  }

  if (!user.id || !resolvedTenantId) {
    return {
      resolvedTenantId: resolvedTenantId || null,
      lockedMerchantId,
      allowedMerchantIds: [],
      allowedBranchIds: []
    }
  }

  const assignments = await prisma.userScopeAssignment.findMany({
    where: {
      userId: user.id,
      tenantId: resolvedTenantId,
      active: true
    },
    select: {
      scopeType: true,
      merchantAccountId: true,
      branchId: true,
      branch: {
        select: {
          merchantAccountId: true
        }
      }
    }
  })

  const merchantSet = new Set<string>()
  const branchSet = new Set<string>()

  for (const item of assignments) {
    if (item.scopeType === 'MERCHANT' && item.merchantAccountId) {
      merchantSet.add(item.merchantAccountId)
    }
    if (item.scopeType === 'BRANCH' && item.branchId) {
      branchSet.add(item.branchId)
      if (item.branch?.merchantAccountId) merchantSet.add(item.branch.merchantAccountId)
    }
  }

  if (lockedMerchantId) merchantSet.add(lockedMerchantId)

  return {
    resolvedTenantId,
    lockedMerchantId,
    allowedMerchantIds: Array.from(merchantSet),
    allowedBranchIds: Array.from(branchSet)
  }
}

export async function assertPermission(event: H3Event, permission: AppPermission) {
  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!hasPermission(user.role, permission)) {
    throw createError({ statusCode: 403, statusMessage: `Permission denied: ${permission}` })
  }
  return user
}

export async function assertAnyPermission(event: H3Event, permissions: AppPermission[]) {
  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!permissions.some(permission => hasPermission(user.role, permission))) {
    throw createError({ statusCode: 403, statusMessage: `Permission denied: ${permissions.join(' | ')}` })
  }
  return user
}
