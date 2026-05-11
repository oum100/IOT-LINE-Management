import { getQuery, getRouterParam } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const offerId = getRouterParam(event, 'offerId')
  const scope = String(getQuery(event).scope || 'asset')
  if (!offerId) throw createError({ statusCode: 400, statusMessage: 'Missing offer id' })

  const target = await prisma.assetProductOffer.findUnique({
    where: { id: offerId },
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
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Offer not found' })
  if (!target.active) return { ok: true, changed: false }

  if (scope === 'branch') {
    await prisma.assetProductOffer.updateMany({
      where: {
        active: true,
        pricingType: target.pricingType,
        productId: target.productId,
        amount: target.amount,
        priority: target.priority,
        effectiveFrom: target.effectiveFrom,
        effectiveTo: target.effectiveTo,
        asset: { branchId: target.asset.branchId }
      },
      data: { active: false, reason: 'paused-by-admin-branch' }
    })
  } else {
    await prisma.assetProductOffer.update({
      where: { id: offerId },
      data: { active: false, reason: 'paused-by-admin' }
    })
  }

  return { ok: true, changed: true, scope }
})
