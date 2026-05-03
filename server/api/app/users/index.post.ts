import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertPermission, isPlatformRole, resolvePortalScopeContext } from '../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

const bodySchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).nullable().optional(),
  role: z.enum(['OWNER', 'MANAGER', 'STAFF']).default('STAFF'),
  isActive: z.boolean().default(true),
  merchantAccountId: z.string().trim().min(1).nullable().optional(),
  scopeAssignments: z.object({
    merchantIds: z.array(z.string().trim().min(1)).default([]),
    branchIds: z.array(z.string().trim().min(1)).default([])
  }).optional()
})

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.user.manage')
  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = bodySchema.parse(await readBody(event))

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId

  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  if (body.merchantAccountId) {
    const merchant = await prisma.merchantAccount.findFirst({
      where: { id: body.merchantAccountId, tenantId: resolvedTenantId },
      select: { id: true }
    })
    if (!merchant) {
      throw createError({ statusCode: 400, statusMessage: 'Merchant not found in this tenant' })
    }
  }

  const merchantIds = body.scopeAssignments?.merchantIds || []
  const branchIds = body.scopeAssignments?.branchIds || []

  const [scopeMerchants, scopeBranches] = await Promise.all([
    merchantIds.length
      ? prisma.merchantAccount.findMany({
          where: { tenantId: resolvedTenantId, id: { in: merchantIds } },
          select: { id: true }
        })
      : Promise.resolve([]),
    branchIds.length
      ? prisma.branch.findMany({
          where: { tenantId: resolvedTenantId, id: { in: branchIds } },
          select: { id: true, merchantAccountId: true }
        })
      : Promise.resolve([])
  ])
  if (scopeMerchants.length !== merchantIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Some merchant scopes are invalid' })
  }
  if (scopeBranches.length !== branchIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Some branch scopes are invalid' })
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        tenantId: resolvedTenantId,
        merchantAccountId: body.merchantAccountId ?? null,
        email: body.email,
        name: body.name ?? null,
        role: body.role,
        isActive: body.isActive
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        tenantId: true,
        merchantAccountId: true
      }
    })

    if (body.role === 'MANAGER' || body.role === 'STAFF') {
      const rows = [
        ...scopeMerchants.map((m) => ({
          userId: created.id,
          tenantId: resolvedTenantId,
          scopeType: 'MERCHANT' as const,
          merchantAccountId: m.id,
          branchId: null
        })),
        ...scopeBranches.map((b) => ({
          userId: created.id,
          tenantId: resolvedTenantId,
          scopeType: 'BRANCH' as const,
          merchantAccountId: b.merchantAccountId || null,
          branchId: b.id
        }))
      ]
      if (rows.length) {
        await tx.userScopeAssignment.createMany({ data: rows })
      }
    }

    return created
  })
})
