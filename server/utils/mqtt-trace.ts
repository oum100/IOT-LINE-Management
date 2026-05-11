import { prisma } from './prisma'

type LogMqttTraceInput = {
  tenantId?: string | null
  mqttServerId?: string | null
  direction: string
  topic: string
  qos?: number | null
  payload?: unknown
  status?: string | null
  note?: string | null
}

export async function resolveTenantMqtt(tenantId?: string | null) {
  if (!tenantId) return null
  const orm = prisma as any
  if (!orm?.tenantMqttBinding?.findUnique) return null
  const binding = await orm.tenantMqttBinding.findUnique({
    where: { tenantId },
    include: {
      mqttServer: {
        select: {
          id: true,
          code: true,
          name: true,
          host: true,
          port: true,
          protocol: true,
          status: true
        }
      }
    }
  })
  return binding || null
}

function safeJson(input: unknown) {
  if (input === undefined || input === null) return null
  try {
    return JSON.parse(JSON.stringify(input))
  } catch {
    return { raw: String(input) }
  }
}

export async function logMqttTrace(input: LogMqttTraceInput) {
  try {
    const orm = prisma as any
    if (!orm?.mqttTrace?.create) return
    await orm.mqttTrace.create({
      data: {
        tenantId: input.tenantId || null,
        mqttServerId: input.mqttServerId || null,
        direction: input.direction,
        topic: input.topic,
        qos: input.qos ?? null,
        payload: safeJson(input.payload),
        status: input.status || null,
        note: input.note || null
      }
    })
  } catch (error) {
    console.warn('[mqtt-trace] failed to persist trace', error)
  }
}
