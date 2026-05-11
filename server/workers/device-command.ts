import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { DeviceCommandStatus } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { logMqttTrace, resolveTenantMqtt } from '../utils/mqtt-trace'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null
})

new Worker(
  'laundry-device-commands',
  async (job) => {
    const commandId = String((job.data.commandId as string | undefined) || job.id || '').trim()
    const fallbackOrderItemId = job.data.orderItemId as string | undefined

    const command = commandId
      ? await prisma.deviceCommand.findUnique({
          where: { id: commandId },
          include: {
            machine: true,
            order: true
          }
        })
      : null

    const resolvedOrderItemId =
      (command?.payloadJson ? (() => {
        try {
          const parsed = JSON.parse(command.payloadJson) as Record<string, unknown>
          return typeof parsed.orderItemId === 'string' ? parsed.orderItemId : ''
        } catch {
          return ''
        }
      })() : '') || fallbackOrderItemId || ''

    if (!resolvedOrderItemId) return

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: resolvedOrderItemId },
      include: { order: true, machine: true }
    })

    if (!orderItem) {
      return
    }
    if (!orderItem.machineId || !orderItem.machine) {
      return
    }

    const payload = {
      commandRef: command?.commandRef || null,
      machineCode: orderItem.machine.code,
      durationMinutes: orderItem.durationMinutes,
      orderNumber: orderItem.order.orderNumber,
      orderId: orderItem.orderId,
      orderItemId: orderItem.id
    }

    console.info('Send command to IoT bridge here', {
      ...payload
    })

    const mqttBinding = await resolveTenantMqtt(orderItem.machine.tenantId || null)
    const topicPrefix = String(mqttBinding?.topicPrefix || '').replace(/\/+$/, '')
    const machineTopic = String(orderItem.machine.topic || '').trim()
    const topic = machineTopic || (topicPrefix ? `${topicPrefix}/${orderItem.machine.code}/command/start` : `machine/${orderItem.machine.code}/command/start`)
    if (command) {
      await prisma.deviceCommand.update({
        where: { id: command.id },
        data: {
          status: DeviceCommandStatus.SENT,
          lastAttemptAt: new Date(),
          errorMessage: null
        }
      })
    }
    await logMqttTrace({
      tenantId: orderItem.machine.tenantId || null,
      mqttServerId: mqttBinding?.mqttServerId || null,
      direction: 'OUTBOUND_PUBLISH',
      topic,
      qos: 1,
      payload,
      status: 'SENT',
      note: 'START_PROGRAM command published for IoT bridge'
    })
  },
  { connection }
)
