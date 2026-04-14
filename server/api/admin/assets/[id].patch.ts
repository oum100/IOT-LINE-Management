import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  branchId: z.string().optional(),
  code: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(140).optional(),
  kind: z.enum(['WASHER', 'DRYER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  const body = schema.parse(await readBody(event))
  return prisma.asset.update({
    where: { id },
    data: body
  })
})
