import { readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const bodySchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(1).max(999).default(100),
  active: z.boolean().default(true)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = bodySchema.parse(await readBody(event))
  const code = body.code.toUpperCase()
  const item = await prisma.serviceModeType.create({
    data: { code, name: body.name, sortOrder: body.sortOrder, active: body.active }
  })
  return item
})
