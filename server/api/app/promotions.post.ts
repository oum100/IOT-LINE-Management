import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { overlaps } from '../../utils/asset-lifecycle'
import { assertPermission, isPlatformRole, resolvePortalScopeContext } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

const schema = z.object({
  productId: z.string().min(1),
  branchId: z.string().min(1),
  amount: z.coerce.number().int().min(0),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional().nullable(),
  priority: z.coerce.number().int().min(1).max(999).default(100),
  reason: z.string().trim().max(160).optional(),
  replaceActive: z.coerce.boolean().optional().default(false)
})

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: Role; tenantId?: string | null } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId
  if (!isPlatformRole(user.role) && !resolvedTenantId) throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  const body = schema.parse(await readBody(event))
  const from = new Date(body.effectiveFrom)
  const to = body.effectiveTo ? new Date(body.effectiveTo) : null
  if (to && to <= from) {
    throw createError({ statusCode: 400, statusMessage: 'effectiveTo must be greater than effectiveFrom' })
  }
  if (scope.allowedBranchIds !== null && !scope.allowedBranchIds.includes(body.branchId)) {
    throw createError({ statusCode: 403, statusMessage: 'Branch is outside your scope' })
  }

  return prisma.$transaction(async (tx) => {
    const targetProduct = await tx.product.findUnique({
      where: { id: body.productId },
      select: { id: true, name: true, tenantId: true }
    })
    if (!targetProduct || targetProduct.tenantId !== resolvedTenantId) {
      throw createError({ statusCode: 404, statusMessage: 'Product not found in tenant scope' })
    }

    let bindings = await tx.assetProductPrice.findMany({
      where: {
        tenantId: resolvedTenantId,
        asset: {
          branchId: body.branchId,
          ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
        },
        productId: body.productId,
        active: true
      },
      select: {
        tenantId: true,
        assetId: true,
        productId: true,
        durationMinutes: true,
        serviceMode: true,
        serviceUnit: true,
        quantity: true
      }
    })

    if (!bindings.length) {
      const fallbackRows = await tx.assetProductPrice.findMany({
        where: {
          tenantId: resolvedTenantId,
          asset: {
            branchId: body.branchId,
            ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
          },
          active: true,
          product: { name: targetProduct.name }
        },
        select: {
          tenantId: true,
          assetId: true,
          productId: true,
          durationMinutes: true,
          serviceMode: true,
          serviceUnit: true,
          quantity: true,
          product: { select: { id: true, code: true } }
        }
      })
      const distinctProductIds = Array.from(new Set(fallbackRows.map(r => r.productId)))
      if (distinctProductIds.length > 1) {
        throw createError({ statusCode: 409, statusMessage: `Multiple products named ${targetProduct.name} found in selected branch. Please select by exact code.` })
      }
      if (distinctProductIds.length === 1) {
        bindings = fallbackRows.map(({ product, ...rest }) => rest)
      }
    }
    if (!bindings.length) {
      throw createError({ statusCode: 404, statusMessage: 'No active product bindings found in selected branch' })
    }

    const existing = await tx.assetProductOffer.findMany({
      where: {
        tenantId: resolvedTenantId,
        assetId: { in: bindings.map(b => b.assetId) },
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
        data: { active: false, reason: 'replaced-by-branch-promotion' }
      })
    }

    const created = await tx.assetProductOffer.createMany({
      data: bindings.map(binding => ({
        tenantId: binding.tenantId,
        assetId: binding.assetId,
        productId: binding.productId,
        pricingType: 'PROMOTION' as const,
        amount: body.amount,
        durationMinutes: binding.durationMinutes,
        serviceMode: binding.serviceMode,
        serviceUnit: binding.serviceUnit,
        quantity: binding.quantity,
        priority: body.priority,
        effectiveFrom: from,
        effectiveTo: to,
        reason: body.reason || 'branch-promotion'
      }))
    })

    return { ok: true, createdCount: created.count }
  })
})
