import { prisma } from './prisma'

type LogPaymentTraceInput = {
  paymentId?: string | null
  orderId?: string | null
  stage: string
  direction: string
  providerCode?: string | null
  statusCode?: number | null
  requestHeaders?: unknown
  requestBody?: unknown
  responseBody?: unknown
  mappedStatus?: string | null
  note?: string | null
}

function safeJson(input: unknown) {
  if (input === undefined) return null
  if (input === null) return null
  try {
    return JSON.parse(JSON.stringify(input))
  } catch {
    return { raw: String(input) }
  }
}

export async function logPaymentTrace(input: LogPaymentTraceInput) {
  try {
    const orm = prisma as any
    if (!orm?.paymentTrace?.create) return
    await orm.paymentTrace.create({
      data: {
        paymentId: input.paymentId || null,
        orderId: input.orderId || null,
        stage: String(input.stage || '').trim() || 'UNKNOWN',
        direction: String(input.direction || '').trim() || 'UNKNOWN',
        providerCode: input.providerCode || null,
        statusCode: input.statusCode ?? null,
        requestHeaders: safeJson(input.requestHeaders),
        requestBody: safeJson(input.requestBody),
        responseBody: safeJson(input.responseBody),
        mappedStatus: input.mappedStatus || null,
        note: input.note || null
      }
    })
  } catch (error) {
    console.warn('[payment-trace] failed to persist trace', error)
  }
}
