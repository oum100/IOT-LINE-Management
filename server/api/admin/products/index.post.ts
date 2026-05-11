import { createError, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { assertProductTypeCode, assertServiceModeCode, assertServiceUnitCode } from '../../../utils/product-taxonomy'

const createSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  amount: z.coerce.number().int().min(0).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(0).optional().nullable(),
  serviceMode: z.string().trim().min(1).default('TIME'),
  serviceUnit: z.string().trim().min(1).default('MINUTE'),
  quantity: z.coerce.number().optional().nullable(),
  active: z.boolean().default(true)
})

function toCode(name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 8) || 'PRD'
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${base}_${suffix}`
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = createSchema.parse(await readBody(event))
  const kind = await assertProductTypeCode(body.kind)
  const serviceMode = await assertServiceModeCode(body.serviceMode)
  const serviceUnit = await assertServiceUnitCode(body.serviceUnit)
  const tenant = await prisma.tenant.findUnique({ where: { id: body.tenantId }, select: { id: true } })
  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = toCode(body.name)
    try {
      const created = await prisma.product.create({
        data: {
          tenantId: body.tenantId,
          code,
          name: body.name,
          kind,
          amount: body.amount ?? null,
          durationMinutes: body.durationMinutes ?? null,
          serviceMode,
          serviceUnit,
          quantity: body.quantity == null ? null : String(body.quantity),
          active: body.active
        }
      })
      return created
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err
    }
  }

  throw createError({ statusCode: 409, statusMessage: 'Unable to generate product code' })
})
