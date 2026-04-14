import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  assetId: z.string().optional().nullable(),
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(140),
  kind: z.enum(['WASHER', 'DRYER']),
  status: z.enum(['AVAILABLE', 'RESERVED', 'RUNNING', 'MAINTENANCE']).optional(),
  locationLabel: z.string().trim().min(1).max(120),
  topic: z.string().trim().optional().nullable(),
  remainingMinutes: z.number().int().optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  return prisma.machine.create({
    data: {
      tenantId: body.tenantId,
      merchantAccountId: body.merchantAccountId || null,
      branchId: body.branchId || null,
      assetId: body.assetId || null,
      code: body.code,
      name: body.name,
      kind: body.kind,
      status: body.status || 'AVAILABLE',
      locationLabel: body.locationLabel,
      topic: body.topic || null,
      remainingMinutes: body.remainingMinutes ?? null
    }
  })
})
