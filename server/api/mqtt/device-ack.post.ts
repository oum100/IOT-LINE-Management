import { createError, getHeader, readBody } from 'h3'
import { z } from 'zod'
import { acknowledgeDeviceCommand } from '#server/utils/device-command-ack'

const schema = z.object({
  topic: z.string().trim().min(1).optional(),
  payload: z.unknown().optional(),
  commandRef: z.string().trim().optional(),
  machineCode: z.string().trim().optional(),
  orderItemId: z.string().trim().optional(),
  status: z.enum(['ACK', 'DONE', 'FAILED']),
  note: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const secret = String(process.env.MQTT_WEBHOOK_SECRET || '').trim()
  if (secret) {
    const incoming = String(getHeader(event, 'x-mqtt-secret') || '').trim()
    if (!incoming || incoming !== secret) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid MQTT webhook secret' })
    }
  }

  const body = schema.parse(await readBody(event))
  return await acknowledgeDeviceCommand({
    commandRef: body.commandRef,
    machineCode: body.machineCode,
    orderItemId: body.orderItemId,
    ackStatus: body.status,
    note: body.note,
    topic: body.topic,
    payload: body.payload
  })
})
