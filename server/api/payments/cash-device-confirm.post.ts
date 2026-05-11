import { createError, getHeader, readBody } from 'h3'
import { z } from 'zod'
import { confirmCashDevicePayment } from '../../utils/cash-device-confirm'

const bodySchema = z.object({
  orderId: z.string().trim().optional(),
  orderNumber: z.string().trim().optional(),
  paymentId: z.string().trim().optional(),
  deviceEventRef: z.string().trim().optional(),
  amountPaid: z.coerce.number().int().min(0).optional(),
  source: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const secret = String(process.env.CASH_DEVICE_WEBHOOK_SECRET || process.env.MQTT_WEBHOOK_SECRET || '').trim()
  if (secret) {
    const incoming = String(getHeader(event, 'x-cash-device-secret') || getHeader(event, 'x-mqtt-secret') || '').trim()
    if (!incoming || incoming !== secret) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid cash device webhook secret' })
    }
  }

  const rawBody = await readBody(event).catch(() => ({}))
  const body = bodySchema.parse(rawBody)
  if (!body.orderId && !body.orderNumber && !body.paymentId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId, orderNumber, or paymentId is required' })
  }

  return await confirmCashDevicePayment({
    ...body,
    payload: rawBody,
    headers: event.node.req.headers || null
  })
})
