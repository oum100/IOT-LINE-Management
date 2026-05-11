import { prisma } from '#server/utils/prisma'
import { assertAdminAccess } from '#server/utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetId = getRouterParam(event, 'id')
  if (!assetId) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, tenantId: true, kind: true }
  })
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })

  const boundRows = await prisma.assetProductPrice.findMany({
    where: { tenantId: asset.tenantId, assetId: asset.id, active: true },
    select: { productId: true }
  })
  const boundProductIds = new Set(boundRows.map(r => r.productId))

  const products = await prisma.product.findMany({
    where: {
      tenantId: asset.tenantId,
      kind: asset.kind,
      active: true
    },
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      amount: true,
      quantity: true,
      serviceUnit: true,
      serviceMode: true
    },
    orderBy: [{ name: 'asc' }],
    take: 200
  })

  return {
    items: products
      .filter(p => !boundProductIds.has(p.id))
      .map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        kind: p.kind,
        amount: Number(p.amount || 0),
        quantity: p.quantity ?? null,
        serviceUnit: p.serviceUnit || 'UNIT',
        serviceMode: p.serviceMode || 'TIME'
      }))
  }
})
