import { getHeader } from 'h3'
import { z } from 'zod'
import { assertDeviceAuthByHeader } from '#server/utils/device-runtime'
import { prisma } from '#server/utils/prisma'
import { logMqttTrace } from '#server/utils/mqtt-trace'

const schema = z.object({
  deviceUid: z.string().trim().optional(),
  eventType: z.string().trim().min(1).max(80),
  eventAt: z.string().datetime().optional(),
  severity: z.enum(['info', 'warning', 'error']).default('info'),
  data: z.record(z.string(), z.unknown()).optional(),
  note: z.string().trim().max(200).optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const auth = await assertDeviceAuthByHeader(getHeader(event, 'x-device-key'))
  const device = await prisma.iotDevice.findUnique({
    where: { id: auth.iotDeviceId },
    select: { id: true, deviceUid: true, tenantId: true }
  })
  if (!device) throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  if (body.deviceUid && device.deviceUid && body.deviceUid !== device.deviceUid) {
    throw createError({ statusCode: 403, statusMessage: 'Device UID mismatch' })
  }

  await logMqttTrace({
    tenantId: device.tenantId,
    direction: 'INBOUND_DEVICE_EVENT',
    topic: `device/${device.deviceUid || device.id}/events/${body.eventType}`,
    payload: {
      eventAt: body.eventAt || new Date().toISOString(),
      severity: body.severity,
      data: body.data || {}
    },
    status: body.severity.toUpperCase(),
    note: body.note || `Device event: ${body.eventType}`
  })

  return { ok: true }
})
