import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { assertProductTypeCode, assertServiceModeCode, assertServiceUnitCode } from '../../../utils/product-taxonomy'

const bodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  kind: z.string().trim().min(1).optional(),
  amount: z.coerce.number().int().min(0).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(0).optional().nullable(),
  serviceMode: z.string().trim().min(1).optional(),
  serviceUnit: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().optional().nullable(),
  active: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Product id is required' })

  const body = bodySchema.parse(await readBody(event))
  const kind = body.kind !== undefined ? await assertProductTypeCode(body.kind) : undefined
  const serviceMode = body.serviceMode !== undefined ? await assertServiceModeCode(body.serviceMode) : undefined
  const serviceUnit = body.serviceUnit !== undefined ? await assertServiceUnitCode(body.serviceUnit) : undefined
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Product not found' })

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(body.amount !== undefined ? { amount: body.amount } : {}),
      ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
      ...(serviceMode !== undefined ? { serviceMode } : {}),
      ...(serviceUnit !== undefined ? { serviceUnit } : {}),
      ...(body.quantity !== undefined ? { quantity: body.quantity == null ? null : String(body.quantity) } : {}),
      ...(body.active !== undefined ? { active: body.active } : {})
    }
  })

  return updated
})
