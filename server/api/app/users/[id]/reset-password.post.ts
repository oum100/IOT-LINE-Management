import { getServerSession } from '#auth'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertPermission, isPlatformRole, resolvePortalScopeContext } from '../../../../utils/rbac'
import { hashPassword } from '../../../../utils/password'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

const schema = z.object({
  password: z.string().min(8).default('P@ssw0rd')
})

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

  const role = String(user.role || '').toUpperCase()
  if (!isPlatformRole(user.role) && role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'Only tenant owner can reset password' })
  }

  const body = schema.parse((await readBody(event)) || {})
  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId
  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  const target = await prisma.user.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true }
  })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found in this tenant' })

  const passwordHash = await hashPassword(body.password)
  await prisma.user.update({
    where: { id },
    data: { passwordHash }
  })

  return { ok: true }
})
