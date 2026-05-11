import { getServerSession } from '#auth'
import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertPermission } from '../../../utils/rbac'
import { assertProductTypeCode, assertServiceModeCode, assertServiceUnitCode } from '../../../utils/product-taxonomy'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.string().trim().min(1).max(40),
  amount: z.coerce.number().int().positive(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  serviceMode: z.string().trim().min(1).optional(),
  serviceUnit: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  status: z.enum(['ACTIVE', 'DISABLED'])
})

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Product id is required' })
  }

  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

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

  const normalizedKind = await assertProductTypeCode(body.kind)
  const serviceMode = await assertServiceModeCode(body.serviceMode ?? 'TIME')
  const serviceUnit = await assertServiceUnitCode(body.serviceUnit ?? (serviceMode === 'TIME' ? 'MINUTE' : 'UNIT'))
  const quantity = body.quantity ?? (body.durationMinutes ?? null)
  const durationMinutes = body.durationMinutes
    ?? (serviceMode === 'TIME' && serviceUnit === 'MINUTE' && quantity ? Math.max(1, Math.round(quantity)) : null)

  if (!quantity) {
    throw createError({ statusCode: 400, statusMessage: 'Quantity is required' })
  }

  const target = await prisma.product.findFirst({
    where: {
      id,
      tenantId: resolvedTenantId
    },
    select: { id: true }
  })

  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found in tenant scope' })
  }

  const hasCompletedOrders = await prisma.orderItem.findFirst({
    where: {
      status: 'COMPLETED',
      asset: {
        is: {
          tenantId: resolvedTenantId,
          prices: {
            some: {
              productId: target.id
            }
          }
        }
      }
    },
    select: { id: true }
  })

  if (hasCompletedOrders) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Product cannot be edited because completed orders reference it'
    })
  }

  const updated = await prisma.product.update({
    where: { id: target.id },
    data: {
      name: body.name.trim(),
      kind: normalizedKind,
      amount: body.amount,
      durationMinutes,
      serviceMode,
      serviceUnit,
      quantity,
      active: body.status === 'ACTIVE'
    },
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      amount: true,
      durationMinutes: true,
      serviceMode: true,
      serviceUnit: true,
      quantity: true,
      active: true,
      updatedAt: true
    }
  })

  return updated
})
