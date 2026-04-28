import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  merchantAccountId: z.string().nullable().optional()
})

export default defineEventHandler(async (event) => {
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
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  const found = await prisma.branch.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true }
  })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Branch not found' })

  if (body.merchantAccountId) {
    const merchant = await prisma.merchantAccount.findFirst({
      where: { id: body.merchantAccountId, tenantId: resolvedTenantId },
      select: { id: true }
    })
    if (!merchant) throw createError({ statusCode: 404, statusMessage: 'Merchant not found in this tenant' })
  }

  return prisma.branch.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.merchantAccountId !== undefined ? { merchantAccountId: body.merchantAccountId } : {})
    },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      merchantAccountId: true,
      updatedAt: true
    }
  })
})
