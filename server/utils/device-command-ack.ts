import { DeviceCommandStatus, MachineStatus, OrderItemStatus } from '@prisma/client'
import { createError } from 'h3'
import { prisma } from './prisma'
import { logMqttTrace, resolveTenantMqtt } from './mqtt-trace'

export async function acknowledgeDeviceCommand(input: {
  commandRef?: string | null
  machineCode?: string | null
  orderItemId?: string | null
  ackStatus: 'ACK' | 'DONE' | 'FAILED'
  note?: string | null
  topic?: string | null
  payload?: unknown
}) {
  const commandRef = String(input.commandRef || '').trim()
  const machineCode = String(input.machineCode || '').trim()
  const orderItemId = String(input.orderItemId || '').trim()

  const command = await prisma.deviceCommand.findFirst({
    where: {
      OR: [
        commandRef ? { commandRef } : undefined,
        orderItemId ? { payloadJson: { contains: orderItemId } } : undefined
      ].filter(Boolean) as any
    },
    include: {
      machine: true
    },
    orderBy: { queuedAt: 'desc' }
  })

  if (!command) {
    throw createError({ statusCode: 404, statusMessage: 'Device command not found for ACK' })
  }

  if (machineCode && command.machine.code !== machineCode) {
    throw createError({ statusCode: 409, statusMessage: 'Machine code mismatch for command ACK' })
  }

  const now = new Date()
  if (input.ackStatus === 'ACK') {
    await prisma.deviceCommand.update({
      where: { id: command.id },
      data: {
        status: DeviceCommandStatus.ACKNOWLEDGED,
        acknowledgedAt: now,
        errorMessage: null
      }
    })
  } else if (input.ackStatus === 'DONE') {
    await prisma.$transaction(async (tx) => {
      await tx.deviceCommand.update({
        where: { id: command.id },
        data: {
          status: DeviceCommandStatus.COMPLETED,
          acknowledgedAt: command.acknowledgedAt || now,
          completedAt: now,
          errorMessage: null
        }
      })

      const parsed = JSON.parse(command.payloadJson || '{}') as Record<string, unknown>
      const parsedOrderItemId = typeof parsed.orderItemId === 'string' ? parsed.orderItemId : ''
      if (parsedOrderItemId) {
        await tx.orderItem.updateMany({
          where: {
            id: parsedOrderItemId,
            status: OrderItemStatus.RUNNING
          },
          data: {
            status: OrderItemStatus.COMPLETED,
            completedAt: now
          }
        })
      }

      await tx.machine.update({
        where: { id: command.machineId },
        data: {
          status: MachineStatus.AVAILABLE,
          remainingMinutes: null
        }
      })
    })
  } else {
    await prisma.deviceCommand.update({
      where: { id: command.id },
      data: {
        status: DeviceCommandStatus.FAILED,
        completedAt: now,
        errorMessage: input.note || 'Device reported failure'
      }
    })
  }

  const mqttBinding = await resolveTenantMqtt(command.machine.tenantId || null)
  await logMqttTrace({
    tenantId: command.machine.tenantId || null,
    mqttServerId: mqttBinding?.mqttServerId || null,
    direction: 'INBOUND_SUBSCRIBE',
    topic: input.topic || `machine/${command.machine.code}/ack`,
    qos: 1,
    payload: input.payload || null,
    status: input.ackStatus,
    note: input.note || `Device command ${input.ackStatus}`
  })

  return { ok: true, commandId: command.id, status: input.ackStatus }
}
