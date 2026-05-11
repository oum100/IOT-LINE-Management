import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { assertPermission } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

const bodySchema = z.object({
  serialNo: z.string().trim().regex(/^[A-Za-z0-9]{13}$/, 'Serial No must be 13 alphanumeric characters'),
  brand: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
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
  if (!resolvedTenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })
  }

  const created = await prisma.machine.create({
    data: {
      tenantId: resolvedTenantId,
      code: `MU-${body.serialNo.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || Date.now().toString().slice(-6)}`,
      name: body.serialNo,
      serialNo: body.serialNo,
      brand: body.brand || null,
      model: body.model || null,
      kind: 'WASHER',
      locationLabel: 'Unassigned',
      status: 'SPARE'
    },
    select: {
      id: true,
      serialNo: true,
      brand: true,
      model: true,
      status: true
    }
  })

  return created
})
