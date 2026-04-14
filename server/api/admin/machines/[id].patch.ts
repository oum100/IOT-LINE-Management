import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  merchantAccountId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  assetId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(140).optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'RUNNING', 'MAINTENANCE']).optional(),
  locationLabel: z.string().trim().min(1).max(120).optional(),
  topic: z.string().trim().nullable().optional(),
  remainingMinutes: z.number().int().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing machine id' })
  const body = schema.parse(await readBody(event))
  return prisma.machine.update({
    where: { id },
    data: body
  })
})
