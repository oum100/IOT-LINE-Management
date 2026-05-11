import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sortOrder: z.coerce.number().int().min(1).max(999).optional(),
  active: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const rawCode = getRouterParam(event, 'code')
  if (!rawCode) {
    throw createError({ statusCode: 400, statusMessage: 'Product type code is required' })
  }

  const body = bodySchema.parse(await readBody(event))
  const code = String(rawCode).toUpperCase()

  const item = await prisma.productType.update({
    where: { code },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.active !== undefined ? { active: body.active } : {})
    }
  })
  return item
})

