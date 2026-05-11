import { getServerSession } from '#auth'
import { prisma } from '#server/utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '#server/utils/rbac'

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
    select: {
      id: true,
      bindings: {
        where: { tenantId: resolvedTenantId },
        orderBy: { startedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          reason: true,
          iotDevice: {
            select: {
              id: true,
              macAddress: true,
              deviceUid: true,
              name: true,
              model: true
            }
          },
          machine: {
            select: {
              id: true,
              serialNo: true,
              brand: true,
              model: true
            }
          }
        }
      }
    }
  })

  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found in tenant scope' })
  }

  const activeBinding = asset.bindings.find(row => row.status === 'ACTIVE' && !row.endedAt) || null

  return {
    id: asset.id,
    activeBinding,
    bindings: asset.bindings
  }
})

