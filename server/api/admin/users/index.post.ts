import { z } from 'zod'
import { AppUserRole, UserScopeType } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { hashPassword } from '../../../utils/password'
import { resolveDefaultNewUserPassword } from '../../../utils/system-config'

const scopeSchema = z.object({
  merchantIds: z.array(z.string().min(1)).default([]),
  branchIds: z.array(z.string().min(1)).default([])
})

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).optional(),
  name: z.string().trim().nullable().optional(),
  role: z.nativeEnum(AppUserRole),
  isActive: z.boolean().default(true),
  tenantId: z.string().nullable().optional(),
  merchantAccountId: z.string().nullable().optional(),
  scopeAssignments: scopeSchema.optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const email = body.email.toLowerCase().trim()
  const isPlatformRole = body.role === AppUserRole.ADMIN || body.role === AppUserRole.USER

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  const tenantId = isPlatformRole ? null : (body.tenantId || null)
  const merchantAccountId = isPlatformRole ? null : (body.merchantAccountId || null)
  const scopeAssignments = body.scopeAssignments
  const merchantScopeIds = isPlatformRole ? [] : Array.from(new Set(scopeAssignments?.merchantIds || []))
  const branchScopeIds = isPlatformRole ? [] : Array.from(new Set(scopeAssignments?.branchIds || []))
  const requiresScopeContext = body.role === AppUserRole.MANAGER || body.role === AppUserRole.STAFF

  if (merchantAccountId && !tenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant is required when merchant is selected' })
  }

  if (requiresScopeContext && !tenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant is required for manager/staff scope assignment' })
  }

  if (requiresScopeContext && !merchantScopeIds.length && !branchScopeIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Manager/staff must have at least one merchant or branch scope' })
  }

  if ((merchantScopeIds.length || branchScopeIds.length) && !tenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant is required for scope assignments' })
  }

  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
    if (!tenant) throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  if (merchantAccountId) {
    const merchant = await prisma.merchantAccount.findUnique({
      where: { id: merchantAccountId },
      select: { id: true, tenantId: true }
    })
    if (!merchant) throw createError({ statusCode: 404, statusMessage: 'Merchant not found' })
    if (tenantId && merchant.tenantId !== tenantId) {
      throw createError({ statusCode: 400, statusMessage: 'Merchant is not under selected tenant' })
    }
  }

  const passwordHash = await hashPassword((body.password && body.password.trim()) ? body.password : await resolveDefaultNewUserPassword())

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: body.name?.trim() || null,
        role: body.role,
        isActive: body.isActive,
        tenantId,
        merchantAccountId
      },
      select: { id: true }
    })

    if (tenantId && (merchantScopeIds.length || branchScopeIds.length)) {
      const merchants = merchantScopeIds.length
        ? await tx.merchantAccount.findMany({
            where: { id: { in: merchantScopeIds }, tenantId },
            select: { id: true }
          })
        : []

      if (merchantScopeIds.length !== merchants.length) {
        throw createError({ statusCode: 400, statusMessage: 'Some merchant scopes are invalid' })
      }

      const branches = branchScopeIds.length
        ? await tx.branch.findMany({
            where: { id: { in: branchScopeIds }, tenantId },
            select: { id: true, merchantAccountId: true }
          })
        : []

      if (branchScopeIds.length !== branches.length) {
        throw createError({ statusCode: 400, statusMessage: 'Some branch scopes are invalid' })
      }

      const rows = [
        ...merchantScopeIds.map((id) => ({
          userId: user.id,
          tenantId,
          scopeType: UserScopeType.MERCHANT,
          merchantAccountId: id,
          branchId: null,
          active: true
        })),
        ...branches.map((branch) => ({
          userId: user.id,
          tenantId,
          scopeType: UserScopeType.BRANCH,
          merchantAccountId: branch.merchantAccountId,
          branchId: branch.id,
          active: true
        }))
      ]

      if (rows.length) {
        await tx.userScopeAssignment.createMany({ data: rows })
      }
    }

    return user
  })

  return { ok: true, id: created.id }
})
