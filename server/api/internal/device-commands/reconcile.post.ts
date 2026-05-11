import { DeviceCommandStatus } from '@prisma/client'
import { createError, getHeader, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '#server/utils/prisma'
import { logMqttTrace, resolveTenantMqtt } from '#server/utils/mqtt-trace'
import { getLaundryQueue } from '#server/utils/queue'

const schema = z.object({
  sentTimeoutSec: z.coerce.number().int().min(10).max(3600).default(120),
  pendingTimeoutSec: z.coerce.number().int().min(10).max(3600).default(60),
  limit: z.coerce.number().int().min(1).max(200).default(100)
})

export default defineEventHandler(async (event) => {
  const token = String(getHeader(event, 'x-internal-token') || '').trim()
  const expected = String(process.env.INTERNAL_JOB_TOKEN || '').trim()
  if (expected && token !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid internal token' })
  }

  const body = schema.parse(await readBody(event).catch(() => ({})))
  const now = Date.now()
  const sentCutoff = new Date(now - body.sentTimeoutSec * 1000)
  const pendingCutoff = new Date(now - body.pendingTimeoutSec * 1000)

  const candidates = await prisma.deviceCommand.findMany({
    where: {
      OR: [
        {
          status: DeviceCommandStatus.SENT,
          lastAttemptAt: { lte: sentCutoff }
        },
        {
          status: DeviceCommandStatus.PENDING,
          queuedAt: { lte: pendingCutoff }
        }
      ]
    },
    include: {
      machine: true
    },
    orderBy: { queuedAt: 'asc' },
    take: body.limit
  })

  const redisUrl = useRuntimeConfig().redisUrl
  const queue = getLaundryQueue(redisUrl)
  let requeued = 0
  let deadLettered = 0

  for (const command of candidates) {
    const canRetry = command.retryCount < command.maxRetries
    if (!canRetry) {
      await prisma.deviceCommand.update({
        where: { id: command.id },
        data: {
          status: DeviceCommandStatus.FAILED,
          deadLetteredAt: new Date(),
          errorMessage: 'Command timeout exceeded max retries'
        }
      })
      deadLettered += 1

      const mqttBinding = await resolveTenantMqtt(command.machine.tenantId || null)
      await logMqttTrace({
        tenantId: command.machine.tenantId || null,
        mqttServerId: mqttBinding?.mqttServerId || null,
        direction: 'OUTBOUND_PUBLISH',
        topic: `machine/${command.machine.code}/dead-letter`,
        qos: 1,
        payload: { commandId: command.id, commandRef: command.commandRef, reason: 'max_retries_exceeded' },
        status: 'DEAD_LETTERED',
        note: 'Device command moved to dead letter'
      })
      continue
    }

    await prisma.deviceCommand.update({
      where: { id: command.id },
      data: {
        status: DeviceCommandStatus.PENDING,
        retryCount: { increment: 1 },
        nextRetryAt: new Date(),
        errorMessage: null
      }
    })
    await queue.add('start-machine', { commandId: command.id }, { jobId: command.id })
    requeued += 1
  }

  return {
    ok: true,
    total: candidates.length,
    requeued,
    deadLettered
  }
})
