import { readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const bodySchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(80),
  symbol: z.string().trim().max(16).optional().nullable(),
  sortOrder: z.coerce.number().int().min(1).max(999).default(100),
  active: z.boolean().default(true)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = bodySchema.parse(await readBody(event))
  const code = body.code.toUpperCase()
  const item = await prisma.serviceUnitType.create({
    data: {
      code,
      name: body.name,
      symbol: body.symbol || null,
      sortOrder: body.sortOrder,
      active: body.active
    }
  })
  return item
})
