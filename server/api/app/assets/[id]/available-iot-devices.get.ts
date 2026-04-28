import { getServerSession } from '#auth'
import { getRouterParam } from 'h3'
import { prisma } from '../../../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

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

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, tenantId: resolvedTenantId },
    select: { id: true }
  })
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found in tenant scope' })
  }

  const items = await prisma.iotDevice.findMany({
    where: {
      tenantId: resolvedTenantId,
      status: 'SPARE',
      bindings: {
        none: {
          status: 'ACTIVE',
          endedAt: null
        }
      }
    },
    select: {
      id: true,
      deviceUid: true,
      macAddress: true,
      name: true,
      model: true
    },
    orderBy: [{ createdAt: 'desc' }]
  })

  return { items }
})
