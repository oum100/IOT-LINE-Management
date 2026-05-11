import { getServerSession } from '#auth'
import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { overlaps } from '../../../../utils/asset-lifecycle'
import { assertPermission, resolvePortalScopeContext } from '../../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

const schema = z.object({
  productId: z.string().min(1),
  amount: z.coerce.number().int().min(0),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional().nullable(),
  priority: z.coerce.number().int().min(1).max(999).default(100),
  reason: z.string().trim().max(160).optional(),
  replaceActive: z.coerce.boolean().optional().default(false)
})

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const assetId = getRouterParam(event, 'id')
  if (!assetId) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })

  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: Role } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = schema.parse(await readBody(event))
  const from = new Date(body.effectiveFrom)
  const to = body.effectiveTo ? new Date(body.effectiveTo) : null
  if (to && to <= from) {
    throw createError({ statusCode: 400, statusMessage: 'effectiveTo must be greater than effectiveFrom' })
  }

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId
  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  return prisma.$transaction(async (tx) => {
    const binding = await tx.assetProductPrice.findFirst({
      where: {
        tenantId: resolvedTenantId,
        assetId,
        productId: body.productId,
        active: true,
        asset: {
          ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
          ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
        }
      },
      select: {
        assetId: true,
        productId: true,
        tenantId: true,
        amount: true,
        durationMinutes: true,
        serviceMode: true,
        serviceUnit: true,
        quantity: true
      }
    })
    if (!binding) {
      throw createError({ statusCode: 404, statusMessage: 'Product binding not found for this asset' })
    }

    const existing = await tx.assetProductOffer.findMany({
      where: {
        tenantId: resolvedTenantId,
        assetId,
        productId: body.productId,
        pricingType: 'PROMOTION',
        active: true
      },
      select: {
        id: true,
        effectiveFrom: true,
        effectiveTo: true
      }
    })
    const conflictIds = existing
      .filter(item => overlaps(from, to, item.effectiveFrom, item.effectiveTo))
      .map(item => item.id)
    if (conflictIds.length && !body.replaceActive) {
      throw createError({ statusCode: 409, statusMessage: 'Promotion window overlaps existing active promotion' })
    }
    if (conflictIds.length && body.replaceActive) {
      await tx.assetProductOffer.updateMany({
        where: { id: { in: conflictIds } },
        data: { active: false, reason: 'replaced-by-new-promotion' }
      })
    }

    const created = await tx.assetProductOffer.create({
      data: {
        tenantId: binding.tenantId,
        assetId: binding.assetId,
        productId: binding.productId,
        pricingType: 'PROMOTION',
        amount: body.amount,
        durationMinutes: binding.durationMinutes,
        serviceMode: binding.serviceMode,
        serviceUnit: binding.serviceUnit,
        quantity: binding.quantity,
        priority: body.priority,
        effectiveFrom: from,
        effectiveTo: to,
        reason: body.reason || null
      }
    })

    return { ok: true, offer: created }
  })
})
