import { getServerSession } from '#auth'
import { getRouterParam } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '../../../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const assetId = getRouterParam(event, 'id')
  const productId = getRouterParam(event, 'productId')
  if (!assetId || !productId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id or product id' })
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

  const binding = await prisma.assetProductPrice.findFirst({
    where: {
      tenantId: resolvedTenantId,
      assetId,
      productId,
      ...(scope.allowedBranchIds !== null || scope.allowedMerchantIds !== null
        ? {
            asset: {
              ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
              ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
            }
          }
        : {})
    },
    select: {
      id: true,
      active: true,
      amount: true,
      durationMinutes: true
    }
  })

  if (!binding) {
    throw createError({ statusCode: 404, statusMessage: 'Product binding not found' })
  }

  const linkedOrder = await prisma.orderItem.findFirst({
    where: {
      assetId,
      amount: binding.amount,
      durationMinutes: binding.durationMinutes
    },
    select: { id: true }
  })

  if (linkedOrder) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cannot unbind product because it is referenced by orders'
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.assetProductPrice.update({
      where: { id: binding.id },
      data: { active: false }
    })

    await tx.assetProductOffer.updateMany({
      where: {
        tenantId: resolvedTenantId,
        assetId,
        productId,
        active: true
      },
      data: { active: false }
    })
  })

  return { ok: true }
})
