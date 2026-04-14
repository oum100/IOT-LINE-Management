import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  tenantId: z.string().min(1),
  branchId: z.string().min(1),
  assetUuid: z.string().trim().min(4),
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(140),
  kind: z.enum(['WASHER', 'DRYER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  return prisma.asset.create({
    data: {
      tenantId: body.tenantId,
      branchId: body.branchId,
      assetUuid: body.assetUuid,
      code: body.code,
      name: body.name,
      kind: body.kind,
      status: body.status || 'ACTIVE',
      metadata: body.metadata
    }
  })
})
