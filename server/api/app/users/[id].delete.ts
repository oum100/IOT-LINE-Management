import { getServerSession } from '#auth'
import { prisma } from '../../../utils/prisma'
import { assertPermission, isPlatformRole } from '../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.user.manage')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing user id' })

  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (id === user.id) throw createError({ statusCode: 400, statusMessage: 'Cannot delete current user' })

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
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  const target = await prisma.user.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true, role: true }
  })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found in this tenant' })

  const currentRole = String(user.role || '').toUpperCase()
  const targetRole = String(target.role || '').toUpperCase()
  const currentIsPortalRole = currentRole === 'OWNER' || currentRole === 'MANAGER' || currentRole === 'STAFF'
  const targetIsPlatformRole = targetRole === 'ADMIN' || targetRole === 'USER'
  if (currentIsPortalRole && targetIsPlatformRole) {
    throw createError({ statusCode: 403, statusMessage: 'Portal roles cannot delete platform users' })
  }

  await prisma.account.deleteMany({ where: { userId: id } })
  await prisma.session.deleteMany({ where: { userId: id } })
  await prisma.user.delete({ where: { id } })

  return { ok: true }
})
