import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  code: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(120),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  return prisma.tenant.create({
    data: {
      code: body.code,
      name: body.name,
      status: body.status || 'ACTIVE',
      metadata: body.metadata
    }
  })
})
