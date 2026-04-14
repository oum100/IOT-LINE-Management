import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  deviceUid: z.string().trim().nullable().optional(),
  fwVersion: z.string().trim().nullable().optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing device id' })
  const body = schema.parse(await readBody(event))
  return prisma.iotDevice.update({
    where: { id },
    data: body
  })
})
