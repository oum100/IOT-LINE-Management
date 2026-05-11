import { prisma } from '#server/utils/prisma'
import { assertAdminAccess } from '#server/utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetId = getRouterParam(event, 'id')
  const productId = getRouterParam(event, 'productId')
  if (!assetId || !productId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id or product id' })
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, tenantId: true }
  })
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }

  const binding = await prisma.assetProductPrice.findFirst({
    where: {
      tenantId: asset.tenantId,
      assetId,
      productId,
      active: true
    },
    select: {
      id: true,
      amount: true,
      durationMinutes: true
    }
  })
  if (!binding) {
    throw createError({ statusCode: 404, statusMessage: 'Product binding not found' })
  }

  const linkedOrder = await prisma.orderItem.findFirst({
    where: {
      assetId,
      amount: binding.amount,
      durationMinutes: binding.durationMinutes
    },
    select: { id: true }
  })
  if (linkedOrder) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cannot unbind product because it is referenced by orders'
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.assetProductPrice.update({
      where: { id: binding.id },
      data: { active: false }
    })
    await tx.assetProductOffer.updateMany({
      where: {
        tenantId: asset.tenantId,
        assetId,
        productId,
        active: true
      },
      data: { active: false, reason: 'unbound-by-admin' }
    })
  })

  return { ok: true }
})
