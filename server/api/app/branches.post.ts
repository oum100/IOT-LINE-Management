import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { assertPermission } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  merchantAccountId: z.string().trim().optional().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).default('ACTIVE')
})

function buildCodePrefix(name: string) {
  const chunks = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (chunks.length > 1) {
    return chunks.slice(0, 3).map(chunk => chunk[0]).join('').slice(0, 3) || 'BRN'
  }
  return (chunks[0] || 'BRN').slice(0, 3)
}

async function generateBranchCode(tenantId: string, name: string) {
  const prefix = buildCodePrefix(name)
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `${prefix}_${nanoid(5).toUpperCase()}`
    const exists = await prisma.branch.findFirst({
      where: { tenantId, code },
      select: { id: true }
    })
    if (!exists) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'Failed to generate branch code' })
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.branch.manage')
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

  const merchantId = body.merchantAccountId || null
  if (merchantId) {
    const merchant = await prisma.merchantAccount.findFirst({
      where: { id: merchantId, tenantId: resolvedTenantId },
      select: { id: true }
    })
    if (!merchant) {
      throw createError({ statusCode: 404, statusMessage: 'Merchant not found in this tenant' })
    }
  }

  const code = await generateBranchCode(resolvedTenantId, body.name)
  const created = await prisma.branch.create({
    data: {
      tenantId: resolvedTenantId,
      merchantAccountId: merchantId,
      code,
      name: body.name,
      status: body.status
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

  return created
})
