import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

const bodySchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  status: z.enum(['ACTIVE', 'DISABLED']).default('ACTIVE')
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
  const code = normalizeCode(body.code)
  if (!code) throw createError({ statusCode: 400, statusMessage: 'Machine kind code is required' })

  const exists = await prisma.machineKind.findUnique({
    where: { code },
    select: { code: true }
  })
  if (exists) throw createError({ statusCode: 409, statusMessage: 'Machine kind code already exists' })

  const sortTop = await prisma.machineKind.findFirst({
    select: { sortOrder: true },
    orderBy: [{ sortOrder: 'desc' }]
  })

  const created = await prisma.machineKind.create({
    data: {
      code,
      name: body.name,
      active: body.status === 'ACTIVE',
      sortOrder: (sortTop?.sortOrder || 0) + 10
    },
    select: {
      code: true,
      name: true,
      active: true
    }
  })

  return {
    code: created.code,
    name: created.name,
    active: created.active,
    status: created.active ? 'ACTIVE' : 'DISABLED'
  }
})

