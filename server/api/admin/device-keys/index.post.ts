import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { generateDeviceApiKey } from '../../../utils/device-keys'

const schema = z.object({
  iotDeviceId: z.string().min(1),
  label: z.string().trim().max(120).optional(),
  expiresAt: z.string().datetime().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const generated = generateDeviceApiKey()

  const created = await prisma.deviceApiKey.create({
    data: {
      iotDeviceId: body.iotDeviceId,
      keyPrefix: generated.keyPrefix,
      secretHash: generated.secretHash,
      label: body.label || null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
    }
  })

  return {
    ...created,
    plainKey: generated.key
  }
})
