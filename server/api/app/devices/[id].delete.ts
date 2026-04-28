import { getServerSession } from '#auth'
import { prisma } from '../../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing device id' })

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

  const device = await prisma.iotDevice.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true, status: true, _count: { select: { bindings: true } } }
  })
  if (!device) throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  if (device.status !== 'SPARE') {
    throw createError({ statusCode: 409, statusMessage: 'Only SPARE device can be deleted' })
  }
  if (device._count.bindings > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Device has binding history. Delete blocked.' })
  }

  await prisma.iotDevice.delete({ where: { id } })
  return { ok: true }
})
