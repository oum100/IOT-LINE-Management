import { getServerSession } from '#auth'
import { getRouterParam } from 'h3'
import { prisma } from '../../../../../../utils/prisma'
import { overlaps } from '../../../../../../utils/asset-lifecycle'
import { assertPermission, resolvePortalScopeContext } from '../../../../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const assetId = getRouterParam(event, 'id')
  const offerId = getRouterParam(event, 'offerId')
  if (!assetId || !offerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id or offer id' })
  }

  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: Role } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId
  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  return prisma.$transaction(async (tx) => {
    const target = await tx.assetProductOffer.findFirst({
      where: {
        id: offerId,
        assetId,
        tenantId: resolvedTenantId,
        asset: {
          ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
          ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
        }
      },
      select: {
        id: true,
        active: true,
        productId: true,
        effectiveFrom: true,
        effectiveTo: true,
        pricingType: true
      }
    })
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Offer not found in scope' })
    if (target.active) return { ok: true, changed: false }
    if (target.effectiveTo && target.effectiveTo < new Date()) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot resume expired promotion' })
    }

    const conflicting = await tx.assetProductOffer.findFirst({
      where: {
        tenantId: resolvedTenantId,
        assetId,
        productId: target.productId,
        pricingType: target.pricingType,
        active: true,
        id: { not: target.id }
      },
      select: { id: true, effectiveFrom: true, effectiveTo: true }
    })
    if (conflicting && overlaps(target.effectiveFrom, target.effectiveTo, conflicting.effectiveFrom, conflicting.effectiveTo)) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot resume due to overlap with active promotion' })
    }

    const updated = await tx.assetProductOffer.update({
      where: { id: target.id },
      data: {
        active: true,
        reason: 'portal-manual-resume'
      }
    })
    return { ok: true, changed: true, offer: updated }
  })
})
