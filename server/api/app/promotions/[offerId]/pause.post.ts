import { getServerSession } from '#auth'
import { getQuery, getRouterParam } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { assertPermission, isPlatformRole, resolvePortalScopeContext } from '../../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const offerId = getRouterParam(event, 'offerId')
  const scopeMode = String(getQuery(event).scope || 'asset')
  if (!offerId) throw createError({ statusCode: 400, statusMessage: 'Missing offer id' })

  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: Role; tenantId?: string | null; merchantAccountId?: string | null } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId
  if (!isPlatformRole(user.role) && !resolvedTenantId) throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  const assetWhere: Record<string, unknown> = {}
  if (scope.allowedBranchIds !== null) assetWhere.branchId = { in: scope.allowedBranchIds }
  if (scope.allowedMerchantIds !== null) assetWhere.branch = { merchantAccountId: { in: scope.allowedMerchantIds } }

  const target = await prisma.assetProductOffer.findFirst({
    where: {
      id: offerId,
      tenantId: resolvedTenantId,
      ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {})
    },
    select: {
      id: true,
      active: true,
      pricingType: true,
      productId: true,
      amount: true,
      priority: true,
      effectiveFrom: true,
      effectiveTo: true,
      asset: { select: { branchId: true } }
    }
  })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Offer not found in scope' })
  if (!target.active) return { ok: true, changed: false }

  if (scopeMode === 'branch') {
    await prisma.assetProductOffer.updateMany({
      where: {
        tenantId: resolvedTenantId,
        active: true,
        pricingType: target.pricingType,
        productId: target.productId,
        amount: target.amount,
        priority: target.priority,
        effectiveFrom: target.effectiveFrom,
        effectiveTo: target.effectiveTo,
        asset: { branchId: target.asset.branchId }
      },
      data: { active: false, reason: 'paused-by-portal-branch' }
    })
  } else {
    await prisma.assetProductOffer.update({
      where: { id: offerId },
      data: { active: false, reason: 'paused-by-portal' }
    })
  }

  return { ok: true, changed: true, scope: scopeMode }
})
