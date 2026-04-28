import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

function pricingTypeRank(type: string) {
  if (type === 'PROMOTION') return 0
  if (type === 'SPECIAL') return 1
  return 2
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      tenantId: true,
      kind: true
    }
  })
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }

  try {
    const now = new Date()
    const offers = await prisma.assetProductOffer.findMany({
      where: {
        tenantId: asset.tenantId,
        assetId: asset.id
      },
      include: {
        product: true
      },
      orderBy: [
        { active: 'desc' },
        { effectiveFrom: 'desc' },
        { priority: 'asc' }
      ]
    })

    const current = offers
      .filter(item => item.active && item.effectiveFrom <= now && (!item.effectiveTo || item.effectiveTo >= now))
      .sort((a, b) => {
        const priorityDiff = a.priority - b.priority
        if (priorityDiff !== 0) return priorityDiff
        return pricingTypeRank(a.pricingType) - pricingTypeRank(b.pricingType)
      })
    const upcoming = offers.filter(item => item.active && item.effectiveFrom > now)
    const history = offers.filter(item => !item.active || (item.effectiveTo && item.effectiveTo < now))

    return {
      asset,
      resolvedCurrent: current[0] || null,
      current,
      upcoming,
      history
    }
  } catch {
    const fallback = await prisma.assetProductPrice.findMany({
      where: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        active: true
      },
      include: {
        product: true
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
    })

    const mapped = fallback.map(item => ({
      id: item.id,
      productId: item.productId,
      pricingType: 'STANDARD',
      amount: item.amount,
      durationMinutes: item.durationMinutes,
      priority: item.sortOrder ?? 100,
      effectiveFrom: item.createdAt,
      effectiveTo: null,
      active: item.active,
      reason: null,
      product: item.product
    }))

    return {
      asset,
      resolvedCurrent: mapped[0] || null,
      current: mapped,
      upcoming: [],
      history: []
    }
  }
})
