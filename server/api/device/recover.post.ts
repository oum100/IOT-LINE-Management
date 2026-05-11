import { getHeader } from 'h3'
import { z } from 'zod'
import { assertDeviceAuthByHeader, buildDeviceRuntimeConfig } from '#server/utils/device-runtime'
import { prisma } from '#server/utils/prisma'
import { logMqttTrace } from '#server/utils/mqtt-trace'

const schema = z.object({
  deviceUid: z.string().trim().optional(),
  reason: z.string().trim().max(120).optional().default('nvram_lost')
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const auth = await assertDeviceAuthByHeader(getHeader(event, 'x-device-key'))
  const device = await prisma.iotDevice.findUnique({
    where: { id: auth.iotDeviceId },
    select: { id: true, deviceUid: true, macAddress: true, tenantId: true, status: true }
  })
  if (!device) throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  if (body.deviceUid && device.deviceUid && body.deviceUid !== device.deviceUid) {
    throw createError({ statusCode: 403, statusMessage: 'Device UID mismatch' })
  }

  const runtime = await buildDeviceRuntimeConfig(auth.iotDeviceId)
  await logMqttTrace({
    tenantId: device.tenantId,
    direction: 'INBOUND_RECOVER',
    topic: `device/${device.deviceUid || device.id}/recover`,
    payload: {
      reason: body.reason,
      ready: runtime.ready,
      readiness: runtime.readiness,
      configVersion: runtime.configVersion
    },
    status: 'RECOVERED',
    note: 'Device recover request'
  })

  return {
    ok: true,
    recovered: true,
    ready: runtime.ready,
    readiness: runtime.readiness,
    reason: runtime.reason || runtime.readiness,
    configVersion: runtime.configVersion,
    scope: runtime.scope,
    asset: runtime.asset,
    device: {
      id: device.id,
      deviceUid: device.deviceUid,
      macAddress: device.macAddress,
      status: device.status
    },
    machine: runtime.machine,
    products: runtime.products,
    paymentPolicy: runtime.paymentPolicy
  }
})
