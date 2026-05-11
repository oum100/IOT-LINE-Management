import { getHeader, getQuery } from 'h3'
import { z } from 'zod'
import { assertDeviceAuthByHeader, buildDeviceRuntimeConfig } from '#server/utils/device-runtime'
import { prisma } from '#server/utils/prisma'

const querySchema = z.object({
  deviceUid: z.string().trim().min(1).optional()
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))
  const auth = await assertDeviceAuthByHeader(getHeader(event, 'x-device-key'))

  const device = await prisma.iotDevice.findUnique({
    where: { id: auth.iotDeviceId },
    select: { deviceUid: true, macAddress: true, status: true }
  })
  if (!device) throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  if (query.deviceUid && device.deviceUid && query.deviceUid !== device.deviceUid) {
    throw createError({ statusCode: 403, statusMessage: 'Device UID mismatch' })
  }

  const runtime = await buildDeviceRuntimeConfig(auth.iotDeviceId)
  return {
    ok: true,
    readiness: runtime.readiness,
    configVersion: runtime.configVersion,
    scope: runtime.scope,
    asset: runtime.asset,
    device: {
      deviceUid: device.deviceUid,
      macAddress: device.macAddress,
      status: device.status
    },
    machine: runtime.machine,
    products: runtime.products,
    paymentPolicy: runtime.paymentPolicy
  }
})
