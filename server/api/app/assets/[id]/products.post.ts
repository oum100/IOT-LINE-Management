import { getServerSession } from '#auth'
import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

const bodySchema = z.object({
  productId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }

  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = bodySchema.parse(await readBody(event))

  const resolvedTenantId = user.tenantId
    || (user.merchantAccountId
      ? (await prisma.merchantAccount.findUnique({
          where: { id: user.merchantAccountId },
          select: { tenantId: true }
        }))?.tenantId
      : null)

  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }

  if (!resolvedTenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })
  }

  const [asset, product] = await Promise.all([
    prisma.asset.findFirst({
      where: { id: assetId, tenantId: resolvedTenantId },
      select: { id: true, tenantId: true, kind: true }
    }),
    prisma.product.findFirst({
      where: { id: body.productId, tenantId: resolvedTenantId },
      select: { id: true, tenantId: true, kind: true, amount: true, durationMinutes: true, active: true }
    })
  ])

  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found in tenant scope' })
  }
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found in tenant scope' })
  }
  if (!product.active) {
    throw createError({ statusCode: 409, statusMessage: 'Product is not active' })
  }
  if (asset.kind !== product.kind) {
    throw createError({ statusCode: 409, statusMessage: 'Product type does not match asset type' })
  }

  const existingBinding = await prisma.assetProductPrice.findFirst({
    where: {
      tenantId: resolvedTenantId,
      assetId: asset.id,
      productId: product.id
    },
    select: {
      id: true,
      amount: true,
      durationMinutes: true
    }
  })

  const bindAmount = product.amount ?? existingBinding?.amount ?? null
  const bindDurationMinutes = product.durationMinutes ?? existingBinding?.durationMinutes ?? null
  if (!bindAmount || !bindDurationMinutes) {
    throw createError({ statusCode: 409, statusMessage: 'Product has no price/time to bind' })
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
      active: true
    },
    create: {
      tenantId: resolvedTenantId,
      assetId: asset.id,
      productId: product.id,
      amount: bindAmount,
      durationMinutes: bindDurationMinutes,
      active: true
    },
    select: {
      id: true,
      assetId: true,
      productId: true,
      amount: true,
      durationMinutes: true,
      active: true
    }
  })

  return {
    ok: true,
    binding: bound
  }
})
