import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  merchantAccountId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing branch id' })
  const body = schema.parse(await readBody(event))
  return prisma.branch.update({
    where: { id },
    data: body
  })
})
