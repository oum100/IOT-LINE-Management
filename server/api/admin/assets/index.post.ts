import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { assertMachineKindExists } from '../../../utils/machine-kind'

const schema = z.object({
  tenantId: z.string().min(1),
  branchId: z.string().min(1),
  assetUuid: z.string().trim().min(4).optional(),
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(140),
  kind: z.string().trim().min(1).max(40),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const kind = await assertMachineKindExists(body.kind)
  const code = body.code.trim().toUpperCase()

  const existingByCode = await prisma.asset.findFirst({
    where: { code },
    select: { id: true }
  })
  if (existingByCode) {
    throw createError({ statusCode: 409, statusMessage: 'Asset code already exists' })
  }

  const existingByNameInBranch = await prisma.asset.findFirst({
    where: {
      branchId: body.branchId,
      name: body.name.trim()
    },
    select: { id: true }
  })
  if (existingByNameInBranch) {
    throw createError({ statusCode: 409, statusMessage: 'Asset name already exists in this branch' })
  }

  return prisma.asset.create({
    data: {
      tenantId: body.tenantId,
      branchId: body.branchId,
      assetUuid: (body.assetUuid?.trim() || code),
      code,
      name: body.name,
      kind,
      status: body.status || 'ACTIVE',
      metadata: body.metadata
    }
  })
})
