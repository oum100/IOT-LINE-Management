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
  status: z.enum(['ACTIVE', 'DISABLED']).optional()
})

function normalizeCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default defineEventHandler(async (event) => {
  const codeParam = getRouterParam(event, 'code')
  if (!codeParam) throw createError({ statusCode: 400, statusMessage: 'Missing machine kind code' })
  const code = normalizeCode(codeParam)

  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
  } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (!isPlatformRole(user.role) && !user.tenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }

  const body = bodySchema.parse(await readBody(event))
  const found = await prisma.machineKind.findUnique({
    where: { code },
    select: { code: true }
  })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Machine kind not found' })

  const updated = await prisma.machineKind.update({
    where: { code },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.status ? { active: body.status === 'ACTIVE' } : {})
    },
    select: {
      code: true,
      name: true,
      active: true
    }
  })

  return {
    code: updated.code,
    name: updated.name,
    active: updated.active,
    status: updated.active ? 'ACTIVE' : 'DISABLED'
  }
})

