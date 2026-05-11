import { getServerSession } from '#auth'
import { prisma } from '../../../utils/prisma'
import { assertPermission } from '../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing machine unit id' })

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

  const unit = await prisma.machine.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true, status: true, _count: { select: { bindings: true } } }
  })
  if (!unit) throw createError({ statusCode: 404, statusMessage: 'Machine unit not found' })
  if (unit.status !== 'SPARE') {
    throw createError({ statusCode: 409, statusMessage: 'Only SPARE machine unit can be deleted' })
  }
  if (unit._count.bindings > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Machine unit has binding history. Delete blocked.' })
  }

  await prisma.machine.delete({ where: { id } })
  return { ok: true }
})
