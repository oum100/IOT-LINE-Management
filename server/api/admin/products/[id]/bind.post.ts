import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

const bodySchema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().min(1),
  branchId: z.string().min(1),
  assetId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Product id is required' })
  }
  const body = bodySchema.parse(await readBody(event))

  const [product, branch, asset] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        kind: true,
        active: true,
        amount: true,
        durationMinutes: true,
        serviceMode: true,
        serviceUnit: true,
        quantity: true
      }
    }),
    prisma.branch.findFirst({
      where: {
        id: body.branchId,
        tenantId: body.tenantId,
        merchantAccountId: body.merchantAccountId
      },
      select: { id: true }
    }),
    prisma.asset.findFirst({
      where: {
        id: body.assetId,
        tenantId: body.tenantId,
        branchId: body.branchId
      },
      select: { id: true, kind: true }
    })
  ])

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }
  if (!product.active) {
    throw createError({ statusCode: 409, statusMessage: 'Product is inactive' })
  }
  if (product.tenantId !== body.tenantId) {
    throw createError({ statusCode: 409, statusMessage: 'Product tenant mismatch' })
  }
  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: 'Branch not found for selected tenant/merchant' })
  }
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found in selected branch' })
  }
  if (asset.kind !== product.kind) {
    throw createError({ statusCode: 409, statusMessage: 'Product type does not match asset type' })
  }

  const bindAmount = product.amount ?? 0
  const bindDuration = product.durationMinutes ?? 1
  const bindQuantity = product.quantity ?? (product.durationMinutes ? String(product.durationMinutes) : '1')

  if (!bindAmount) {
    throw createError({ statusCode: 409, statusMessage: 'Product amount is required before binding' })
  }

  const binding = await prisma.assetProductPrice.upsert({
    where: {
      assetId_productId: {
        assetId: asset.id,
        productId: product.id
      }
    },
    update: {
      amount: bindAmount,
      durationMinutes: bindDuration,
      serviceMode: product.serviceMode,
      serviceUnit: product.serviceUnit,
      quantity: bindQuantity,
      active: true
    },
    create: {
      tenantId: body.tenantId,
      assetId: asset.id,
      productId: product.id,
      amount: bindAmount,
      durationMinutes: bindDuration,
      serviceMode: product.serviceMode,
      serviceUnit: product.serviceUnit,
      quantity: bindQuantity,
      active: true
    },
    select: {
      id: true,
      assetId: true,
      productId: true,
      amount: true,
      durationMinutes: true,
      serviceMode: true,
      serviceUnit: true,
      quantity: true,
      active: true
    }
  })

  return { ok: true, binding }
})

