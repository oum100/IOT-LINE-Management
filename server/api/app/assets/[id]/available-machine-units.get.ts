import { getServerSession } from '#auth'
import { getRouterParam } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '../../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }

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

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId

  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })
  }

  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      tenantId: resolvedTenantId,
      ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
      ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
    },
    select: { id: true }
  })
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found in tenant scope' })
  }

  const items = await prisma.machine.findMany({
    where: {
      tenantId: resolvedTenantId,
      status: { in: ['NEW', 'SPARE'] },
      bindings: {
        none: {
          status: 'ACTIVE',
          endedAt: null
        }
      }
    },
    select: {
      id: true,
      serialNo: true,
      brand: true,
      model: true
    },
    orderBy: [{ createdAt: 'desc' }]
  })

  return { items }
})
