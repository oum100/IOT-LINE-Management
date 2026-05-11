import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  merchantAccountId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  assetId: z.string().nullable().optional(),
  serialNumber: z.string().trim().min(1).max(140).optional(),
  name: z.string().trim().min(1).max(140).optional(),
  status: z.enum(['NEW', 'AVAILABLE', 'RESERVED', 'RUNNING', 'MAINTENANCE', 'SPARE', 'BOUND', 'OFFLINE', 'DISABLED']).optional(),
  locationLabel: z.string().trim().min(1).max(120).optional(),
  topic: z.string().trim().nullable().optional(),
  remainingMinutes: z.number().int().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing machine id' })
  const body = schema.parse(await readBody(event))
  const data = { ...body } as Record<string, unknown>
  if (typeof body.serialNumber === 'string' && body.serialNumber.trim()) {
    data.name = body.serialNumber.trim()
    data.serialNo = body.serialNumber.trim()
  }
  delete data.serialNumber
  return prisma.machine.update({
    where: { id },
    data
  })
})
