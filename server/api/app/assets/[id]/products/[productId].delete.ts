import { getServerSession } from '#auth'
import { getRouterParam } from 'h3'
import { prisma } from '../../../../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

export default defineEventHandler(async (event) => {
  const assetId = getRouterParam(event, 'id')
  const productId = getRouterParam(event, 'productId')
  if (!assetId || !productId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id or product id' })
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

  const binding = await prisma.assetProductPrice.findFirst({
    where: {
      tenantId: resolvedTenantId,
      assetId,
      productId
    },
    select: {
      id: true,
      active: true,
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
        tenantId: resolvedTenantId,
        assetId,
        productId,
        active: true
      },
      data: { active: false }
    })
  })

  return { ok: true }
})
