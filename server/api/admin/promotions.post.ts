import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { assertAdminAccess } from '../../utils/admin-auth'
import { overlaps } from '../../utils/asset-lifecycle'

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
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  const from = new Date(body.effectiveFrom)
  const to = body.effectiveTo ? new Date(body.effectiveTo) : null
  if (to && to <= from) {
    throw createError({ statusCode: 400, statusMessage: 'effectiveTo must be greater than effectiveFrom' })
  }

  return prisma.$transaction(async (tx) => {
    const targetProduct = await tx.product.findUnique({
      where: { id: body.productId },
      select: { id: true, name: true }
    })
    if (!targetProduct) {
      throw createError({ statusCode: 404, statusMessage: 'Product not found' })
    }

    let bindings = await tx.assetProductPrice.findMany({
      where: {
        asset: { branchId: body.branchId },
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
          asset: { branchId: body.branchId },
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
        assetId: { in: bindings.map(b => b.assetId) },
        productId: body.productId,
        pricingType: 'PROMOTION',
        active: true
      },
      select: {
        id: true,
        assetId: true,
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
