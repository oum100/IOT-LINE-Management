import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  symbol: z.string().trim().max(16).optional().nullable(),
  sortOrder: z.coerce.number().int().min(1).max(999).optional(),
  active: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const code = String(getRouterParam(event, 'code') || '').trim().toUpperCase()
  if (!code) throw createError({ statusCode: 400, statusMessage: 'Code is required' })
  const body = bodySchema.parse(await readBody(event))
  const item = await prisma.serviceUnitType.update({
    where: { code },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.symbol !== undefined ? { symbol: body.symbol || null } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.active !== undefined ? { active: body.active } : {})
    }
  })
  return item
})
