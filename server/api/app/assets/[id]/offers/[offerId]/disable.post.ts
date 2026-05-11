import { getServerSession } from '#auth'
import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../../utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '../../../../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

const schema = z.object({
  reason: z.string().trim().min(2).max(160).default('disabled-by-portal'),
  metadata: z.record(z.any()).optional()
})

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

  const body = schema.parse(await readBody(event))

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
      select: { id: true, active: true, metadata: true }
    })
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Offer not found in scope' })
    if (!target.active) return { ok: true, changed: false }

    const updated = await tx.assetProductOffer.update({
      where: { id: offerId },
      data: {
        active: false,
        reason: body.reason,
        metadata: {
          ...(typeof target.metadata === 'object' && target.metadata ? target.metadata : {}),
          ...(body.metadata || {}),
          disabledAt: new Date().toISOString()
        }
      }
    })

    return { ok: true, changed: true, offer: updated }
  })
})

