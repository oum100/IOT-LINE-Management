import { createError, getHeader, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '#server/utils/prisma'
import { logMqttTrace, resolveTenantMqtt } from '#server/utils/mqtt-trace'
import { confirmCashDevicePayment } from '#server/utils/cash-device-confirm'
import { acknowledgeDeviceCommand } from '#server/utils/device-command-ack'

const schema = z.object({
  tenantId: z.string().trim().optional(),
  tenantCode: z.string().trim().optional(),
  topic: z.string().trim().min(1),
  qos: z.coerce.number().int().min(0).max(2).optional(),
  payload: z.unknown().optional(),
  status: z.string().trim().optional(),
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
  let tenantId = body.tenantId || ''
  if (!tenantId && body.tenantCode) {
    const tenant = await prisma.tenant.findUnique({
      where: { code: body.tenantCode },
      select: { id: true }
    })
    tenantId = tenant?.id || ''
  }

  const binding = await resolveTenantMqtt(tenantId || null)
  await logMqttTrace({
    tenantId: tenantId || null,
    mqttServerId: binding?.mqttServerId || null,
    direction: 'INBOUND_SUBSCRIBE',
    topic: body.topic,
    qos: body.qos ?? null,
    payload: body.payload,
    status: body.status || 'RECEIVED',
    note: body.note || 'Inbound MQTT event'
  })

  const payload = body.payload
  const payloadObj = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null
  const eventType = String(payloadObj?.eventType || payloadObj?.type || payloadObj?.event || '').trim().toLowerCase()
  const looksLikeCashEvent =
    eventType === 'cash_payment_confirm' ||
    eventType === 'cash_confirm' ||
    eventType === 'coin_bill_paid' ||
    body.topic.toLowerCase().includes('cash')

  if (looksLikeCashEvent && payloadObj) {
    const amountRaw = payloadObj.amountPaid ?? payloadObj.amount ?? payloadObj.receivedAmount ?? null
    const amountPaid = amountRaw === null || amountRaw === undefined ? null : Number(amountRaw)
    await confirmCashDevicePayment({
      orderId: typeof payloadObj.orderId === 'string' ? payloadObj.orderId : null,
      orderNumber: typeof payloadObj.orderNumber === 'string' ? payloadObj.orderNumber : null,
      paymentId: typeof payloadObj.paymentId === 'string' ? payloadObj.paymentId : null,
      deviceEventRef:
        typeof payloadObj.deviceEventRef === 'string'
          ? payloadObj.deviceEventRef
          : typeof payloadObj.eventId === 'string'
            ? payloadObj.eventId
            : null,
      amountPaid: Number.isFinite(amountPaid as number) ? amountPaid : null,
      source: `mqtt:${body.topic}`,
      payload: body.payload,
      headers: event.node.req.headers || null
    })
  }

  const looksLikeDeviceAckEvent =
    eventType === 'device_command_ack' ||
    eventType === 'device_ack' ||
    eventType === 'machine_ack' ||
    body.topic.toLowerCase().includes('/ack')

  if (looksLikeDeviceAckEvent && payloadObj) {
    const ackRaw = String(payloadObj.status || payloadObj.ackStatus || '').trim().toUpperCase()
    const ackStatus = ackRaw === 'DONE' || ackRaw === 'COMPLETED'
      ? 'DONE'
      : ackRaw === 'FAILED' || ackRaw === 'ERROR'
        ? 'FAILED'
        : 'ACK'

    await acknowledgeDeviceCommand({
      commandRef: typeof payloadObj.commandRef === 'string' ? payloadObj.commandRef : null,
      machineCode: typeof payloadObj.machineCode === 'string' ? payloadObj.machineCode : null,
      orderItemId: typeof payloadObj.orderItemId === 'string' ? payloadObj.orderItemId : null,
      ackStatus,
      note: typeof payloadObj.note === 'string' ? payloadObj.note : null,
      topic: body.topic,
      payload: payloadObj
    })
  }

  return { ok: true }
})
