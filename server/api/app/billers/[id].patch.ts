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
  displayName: z.string().trim().min(2).max(120).optional(),
  providerCode: z.enum(['SLIP2GO', 'MAEMANEE', 'KSHOP', 'PROMPTPAY', 'INTERNAL']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']).optional(),
  priority: z.coerce.number().int().min(1).max(999).optional()
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing biller id' })

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

  const found = await prisma.billerProfile.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true }
  })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Biller not found' })

  return prisma.billerProfile.update({
    where: { id },
    data: {
      ...(body.displayName ? { displayName: body.displayName } : {}),
      ...(body.providerCode ? { providerCode: body.providerCode } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {})
    },
    select: {
      id: true,
      code: true,
      displayName: true,
      providerCode: true,
      status: true,
      priority: true
    }
  })
})
