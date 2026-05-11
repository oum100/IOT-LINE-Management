import { getHeader, getQuery } from 'h3'
import { z } from 'zod'
import { assertDeviceAuthByHeader, buildDeviceRuntimeConfig } from '#server/utils/device-runtime'
import { prisma } from '#server/utils/prisma'

const querySchema = z.object({
  deviceUid: z.string().trim().min(1).optional(),
  since: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))
  const auth = await assertDeviceAuthByHeader(getHeader(event, 'x-device-key'))
  const device = await prisma.iotDevice.findUnique({
    where: { id: auth.iotDeviceId },
    select: { deviceUid: true }
  })
  if (!device) throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  if (query.deviceUid && device.deviceUid && query.deviceUid !== device.deviceUid) {
    throw createError({ statusCode: 403, statusMessage: 'Device UID mismatch' })
  }

  const runtime = await buildDeviceRuntimeConfig(auth.iotDeviceId)
  const changed = query.since ? runtime.configVersion > query.since : true
  return {
    ok: true,
    ready: runtime.ready,
    readiness: runtime.readiness,
    configVersion: runtime.configVersion,
    changed
  }
})
