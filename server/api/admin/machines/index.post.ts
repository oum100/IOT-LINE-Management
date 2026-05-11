import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { assertMachineKindExists } from '../../../utils/machine-kind'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  assetId: z.string().optional().nullable(),
  code: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().min(1).max(140).optional(),
  name: z.string().trim().min(1).max(140).optional(),
  kind: z.string().trim().min(1).max(40),
  status: z.enum(['NEW', 'AVAILABLE', 'RESERVED', 'RUNNING', 'MAINTENANCE', 'SPARE', 'BOUND', 'OFFLINE', 'DISABLED']).optional(),
  locationLabel: z.string().trim().min(1).max(120),
  topic: z.string().trim().optional().nullable(),
  remainingMinutes: z.number().int().optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const machineDisplayName = (body.serialNumber || body.name || '').trim()
  if (!machineDisplayName) {
    throw createError({ statusCode: 400, statusMessage: 'Serial number is required' })
  }
  const kind = await assertMachineKindExists(body.kind)
  return prisma.machine.create({
    data: {
      tenantId: body.tenantId,
      merchantAccountId: body.merchantAccountId || null,
      branchId: body.branchId || null,
      assetId: body.assetId || null,
      code: body.code,
      serialNo: machineDisplayName,
      name: machineDisplayName,
      kind,
      status: body.status || 'AVAILABLE',
      locationLabel: body.locationLabel,
      topic: body.topic || null,
      remainingMinutes: body.remainingMinutes ?? null
    }
  })
})
