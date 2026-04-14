import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  tenantId: z.string().min(1),
  macAddress: z.string().trim().min(5),
  deviceUid: z.string().trim().optional().nullable(),
  fwVersion: z.string().trim().optional().nullable(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  return prisma.iotDevice.create({
    data: {
      tenantId: body.tenantId,
      macAddress: body.macAddress.toUpperCase(),
      deviceUid: body.deviceUid || null,
      fwVersion: body.fwVersion || null,
      metadata: body.metadata
    }
  })
})
