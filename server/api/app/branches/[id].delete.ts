import { getServerSession } from '#auth'
import { prisma } from '../../../utils/prisma'
import { assertPermission } from '../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.branch.manage')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing branch id' })

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

  const branch = await prisma.branch.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true, name: true }
  })
  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: 'Branch not found' })
  }

  const orderCount = await prisma.order.count({
    where: { tenantId: resolvedTenantId, branchId: id }
  })
  if (orderCount > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Cannot delete branch with order history' })
  }

  await prisma.branch.delete({ where: { id } })
  return { ok: true }
})
