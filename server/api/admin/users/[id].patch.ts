import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
  tenantId: z.string().nullable().optional(),
  merchantAccountId: z.string().nullable().optional(),
  name: z.string().trim().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
  const body = schema.parse(await readBody(event))

  return prisma.user.update({
    where: { id },
    data: body
  })
})
