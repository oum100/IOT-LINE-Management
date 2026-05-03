import { z } from 'zod'
import { AppUserRole, UserScopeType } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const scopeSchema = z.object({
  merchantIds: z.array(z.string().min(1)).default([]),
  branchIds: z.array(z.string().min(1)).default([])
})

const schema = z.object({
  role: z.nativeEnum(AppUserRole).optional(),
  isActive: z.boolean().optional(),
  tenantId: z.string().nullable().optional(),
  merchantAccountId: z.string().nullable().optional(),
  name: z.string().trim().nullable().optional(),
  scopeAssignments: scopeSchema.optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
  const body = schema.parse(await readBody(event))

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, tenantId: true, merchantAccountId: true }
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const adminCount = await prisma.user.count({
    where: {
      role: AppUserRole.ADMIN
    }
  })

  const nextRole = body.role ?? existing.role
  const isPlatformRole = nextRole === AppUserRole.ADMIN || nextRole === AppUserRole.USER
  const tenantId = isPlatformRole ? null : (body.tenantId !== undefined ? body.tenantId : existing.tenantId)
  const merchantAccountId = isPlatformRole ? null : (body.merchantAccountId !== undefined ? body.merchantAccountId : existing.merchantAccountId)
  const scopeAssignments = body.scopeAssignments
  const merchantScopeIds = isPlatformRole ? [] : Array.from(new Set(scopeAssignments?.merchantIds || []))
  const branchScopeIds = isPlatformRole ? [] : Array.from(new Set(scopeAssignments?.branchIds || []))
  const requiresScopeContext = nextRole === AppUserRole.MANAGER || nextRole === AppUserRole.STAFF
  const assignmentTenantIds = Array.from(new Set([existing.tenantId, tenantId].filter(Boolean))) as string[]

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

  const removesLastAdminRole =
    existing.role === AppUserRole.ADMIN &&
    nextRole !== AppUserRole.ADMIN &&
    adminCount <= 1
  const deactivatesLastAdmin =
    existing.role === AppUserRole.ADMIN &&
    adminCount <= 1 &&
    body.isActive === false

  if (removesLastAdminRole || deactivatesLastAdmin) {
    throw createError({
      statusCode: 409,
      statusMessage: 'The last platform admin cannot be demoted or deactivated.'
    })
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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(isPlatformRole || body.tenantId !== undefined ? { tenantId } : {}),
        ...(isPlatformRole || body.merchantAccountId !== undefined ? { merchantAccountId } : {})
      }
    })

    if (isPlatformRole) {
      await tx.userScopeAssignment.deleteMany({ where: { userId: id } })
      return updated
    }

    if (scopeAssignments) {
      await tx.userScopeAssignment.deleteMany({
        where: {
          userId: id,
          tenantId: { in: assignmentTenantIds }
        }
      })

      if (!merchantScopeIds.length && !branchScopeIds.length) {
        return updated
      }

      if (!tenantId) {
        throw createError({ statusCode: 400, statusMessage: 'Tenant is required for scope assignments' })
      }

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
        ...merchantScopeIds.map((mid) => ({
          userId: id,
          tenantId,
          scopeType: UserScopeType.MERCHANT,
          merchantAccountId: mid,
          branchId: null,
          active: true
        })),
        ...branches.map((branch) => ({
          userId: id,
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

    return updated
  })
})
