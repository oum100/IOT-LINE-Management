import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import { overlaps } from '../../../../utils/asset-lifecycle'
import { assertServiceModeCode, assertServiceUnitCode } from '../../../../utils/product-taxonomy'

const schema = z.object({
  productId: z.string().min(1),
  pricingType: z.enum(['STANDARD', 'PROMOTION', 'SPECIAL']).default('STANDARD'),
  amount: z.number().int().min(0),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  serviceMode: z.string().trim().min(1).optional(),
  serviceUnit: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  priority: z.number().int().min(1).max(999).default(100),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional().nullable(),
  reason: z.string().trim().max(160).optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }
  const body = schema.parse(await readBody(event))

  const from = new Date(body.effectiveFrom)
  const to = body.effectiveTo ? new Date(body.effectiveTo) : null
  const serviceMode = await assertServiceModeCode(body.serviceMode ?? 'TIME')
  const serviceUnit = await assertServiceUnitCode(body.serviceUnit ?? (serviceMode === 'TIME' ? 'MINUTE' : 'UNIT'))
  const quantity = body.quantity ?? (body.durationMinutes ?? null)
  const durationMinutes = body.durationMinutes
    ?? (quantity ? Math.max(1, Math.round(quantity)) : null)

  if (!quantity) {
    throw createError({ statusCode: 400, statusMessage: 'Quantity is required' })
  }
  if (!durationMinutes) {
    throw createError({ statusCode: 400, statusMessage: 'Duration fallback is required' })
  }

  if (to && to <= from) {
    throw createError({ statusCode: 400, statusMessage: 'effectiveTo must be greater than effectiveFrom' })
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM "assets"
      WHERE id = ${assetId}
      FOR UPDATE
    `
    await tx.$queryRaw`
      SELECT id
      FROM "asset_product_offers"
      WHERE "assetId" = ${assetId}
      FOR UPDATE
    `

    const [asset, product] = await Promise.all([
      tx.asset.findUnique({
        where: { id: assetId },
        select: { id: true, tenantId: true, kind: true }
      }),
      tx.product.findUnique({
        where: { id: body.productId },
        select: { id: true, tenantId: true, kind: true, active: true }
      })
    ])

    if (!asset) {
      throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
    }
    if (!product) {
      throw createError({ statusCode: 404, statusMessage: 'Product not found' })
    }
    if (!product.active) {
      throw createError({ statusCode: 409, statusMessage: 'Product is not active' })
    }
    if (asset.tenantId !== product.tenantId) {
      throw createError({ statusCode: 409, statusMessage: 'Product tenant mismatch' })
    }
    if (asset.kind !== product.kind) {
      throw createError({ statusCode: 409, statusMessage: 'Product kind does not match asset kind' })
    }

    const existing = await tx.assetProductOffer.findMany({
      where: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        productId: product.id,
        pricingType: body.pricingType,
        active: true
      },
      select: {
        id: true,
        effectiveFrom: true,
        effectiveTo: true
      }
    })

    const conflict = existing.find(item => overlaps(from, to, item.effectiveFrom, item.effectiveTo))
    if (conflict) {
      throw createError({ statusCode: 409, statusMessage: 'Offer time window overlaps with existing active offer' })
    }

    const created = await tx.assetProductOffer.create({
      data: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        productId: product.id,
        pricingType: body.pricingType,
        amount: body.amount,
        durationMinutes,
        serviceMode,
        serviceUnit,
        quantity,
        priority: body.priority,
        effectiveFrom: from,
        effectiveTo: to,
        reason: body.reason || null,
        metadata: body.metadata || Prisma.JsonNull
      }
    })

    return {
      ok: true,
      offer: created
    }
  })
})
