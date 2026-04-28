import { getServerSession } from '#auth'
import { prisma } from '../../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing merchant id' })

  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined

  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

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

  const merchant = await prisma.merchantAccount.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true, name: true }
  })
  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: 'Merchant not found' })
  }

  const orderCount = await prisma.order.count({
    where: { tenantId: resolvedTenantId, merchantAccountId: id }
  })
  if (orderCount > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Cannot delete merchant with order history' })
  }

  await prisma.merchantAccount.delete({ where: { id } })
  return { ok: true }
})
