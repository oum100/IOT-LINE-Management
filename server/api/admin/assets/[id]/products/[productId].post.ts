import { prisma } from '#server/utils/prisma'
import { assertAdminAccess } from '#server/utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetIdParam = getRouterParam(event, 'id')
  const productIdParam = getRouterParam(event, 'productId')
  const pathMatch = String(event.path || '').match(/\/api\/admin\/assets\/([^/]+)\/products\/([^/]+)$/)
  const assetId = String(assetIdParam || pathMatch?.[1] || '').trim()
  const productId = String(productIdParam || pathMatch?.[2] || '').trim()
  if (!assetId || !productId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id or product id' })
  }

  const [asset, product] = await Promise.all([
    prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, tenantId: true, kind: true }
    }),
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        tenantId: true,
        kind: true,
        active: true,
        amount: true,
        quantity: true,
        serviceMode: true,
        serviceUnit: true,
        durationMinutes: true
      }
    })
  ])

  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  if (!product.active) throw createError({ statusCode: 409, statusMessage: 'Product is not active' })
  if (product.tenantId !== asset.tenantId) throw createError({ statusCode: 409, statusMessage: 'Product tenant mismatch' })
  if (product.kind !== asset.kind) throw createError({ statusCode: 409, statusMessage: 'Product type does not match asset type' })

  const existing = await prisma.assetProductPrice.findFirst({
    where: {
      tenantId: asset.tenantId,
      assetId: asset.id,
      productId: product.id
    },
    select: {
      id: true,
      amount: true,
      durationMinutes: true,
      serviceMode: true,
      serviceUnit: true,
      quantity: true
    }
  })

  const bindAmount = product.amount ?? existing?.amount ?? null
  const bindServiceMode = product.serviceMode ?? existing?.serviceMode ?? 'TIME'
  const bindServiceUnit = product.serviceUnit ?? existing?.serviceUnit ?? 'MINUTE'
  const bindQuantity = product.quantity ?? existing?.quantity ?? (product.durationMinutes ?? existing?.durationMinutes ?? null)
  const bindDurationMinutes = product.durationMinutes
    ?? existing?.durationMinutes
    ?? (bindQuantity ? Math.max(1, Math.round(Number(bindQuantity))) : null)

  if (!bindAmount || !bindQuantity || !bindDurationMinutes) {
    throw createError({ statusCode: 409, statusMessage: 'Product has no price/quantity to bind' })
  }

  const bound = await prisma.assetProductPrice.upsert({
    where: {
      assetId_productId: {
        assetId: asset.id,
        productId: product.id
      }
    },
    update: {
      amount: bindAmount,
      durationMinutes: bindDurationMinutes,
      serviceMode: bindServiceMode,
      serviceUnit: bindServiceUnit,
      quantity: bindQuantity,
      active: true
    },
    create: {
      tenantId: asset.tenantId,
      assetId: asset.id,
      productId: product.id,
      amount: bindAmount,
      durationMinutes: bindDurationMinutes,
      serviceMode: bindServiceMode,
      serviceUnit: bindServiceUnit,
      quantity: bindQuantity,
      active: true
    }
  })

  return { ok: true, binding: bound }
})
