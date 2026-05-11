import { z } from 'zod'
import { prisma } from '../../../../../../utils/prisma'
import { assertAdminAccess } from '../../../../../../utils/admin-auth'

const schema = z.object({
  reason: z.string().trim().min(2).max(160).default('disabled-by-admin'),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetId = getRouterParam(event, 'id')
  const offerId = getRouterParam(event, 'offerId')
  if (!assetId || !offerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id or offer id' })
  }
  const body = schema.parse(await readBody(event))

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM "asset_product_offers"
      WHERE id = ${offerId}
      FOR UPDATE
    `

    const target = await tx.assetProductOffer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        assetId: true,
        active: true,
        metadata: true
      }
    })
    if (!target || target.assetId !== assetId) {
      throw createError({ statusCode: 404, statusMessage: 'Offer not found' })
    }
    if (!target.active) {
      return { ok: true, changed: false }
    }

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

