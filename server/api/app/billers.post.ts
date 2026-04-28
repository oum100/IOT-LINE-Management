import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

const bodySchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  providerCode: z.enum(['SLIP2GO', 'MAEMANEE', 'KSHOP', 'PROMPTPAY', 'INTERNAL']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']).default('ACTIVE'),
  priority: z.coerce.number().int().min(1).max(999).default(100)
})

function buildPrefix(name: string) {
  const chunks = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (chunks.length > 1) return chunks.slice(0, 3).map(c => c[0]).join('').slice(0, 3) || 'BLR'
  return (chunks[0] || 'BLR').slice(0, 3)
}

async function generateBillerCode(tenantId: string, displayName: string) {
  const prefix = buildPrefix(displayName)
  for (let i = 0; i < 12; i += 1) {
    const code = `${prefix}_${nanoid(5).toUpperCase()}`
    const exists = await prisma.billerProfile.findFirst({
      where: { tenantId, code },
      select: { id: true }
    })
    if (!exists) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'Failed to generate biller code' })
}

export default defineEventHandler(async (event) => {
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

  const code = await generateBillerCode(resolvedTenantId, body.displayName)
  return prisma.billerProfile.create({
    data: {
      tenantId: resolvedTenantId,
      code,
      displayName: body.displayName,
      providerCode: body.providerCode,
      status: body.status,
      priority: body.priority
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
