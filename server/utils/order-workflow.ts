import { OrderItemStatus, OrderStatus, PaymentStatus, MachineStatus, DeviceCommandStatus } from '@prisma/client'
import { deviceCommandCounter } from './metrics'
import { prisma } from './prisma'
import { getLaundryQueue } from './queue'
import { sendCustomerNotification } from './notifications'

export async function startOrderMachines(orderId: string) {
  const config = useRuntimeConfig()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          machine: true
        }
      },
      payment: true
    }
  })

  if (!order || !order.payment || order.payment.status !== PaymentStatus.VERIFIED) {
    return
  }

  let queue: ReturnType<typeof getLaundryQueue> | null = null

  try {
    queue = getLaundryQueue(config.redisUrl)
  } catch (error) {
    console.warn('queue init failed, continuing without BullMQ', error)
  }

  for (const item of order.items) {
    const payload = {
      machineCode: item.machine.code,
      durationMinutes: item.durationMinutes,
      orderItemId: item.id
    }

    await prisma.deviceCommand.create({
      data: {
        orderId: order.id,
        machineId: item.machineId,
        commandType: 'START_PROGRAM',
        payloadJson: JSON.stringify(payload),
        status: DeviceCommandStatus.PENDING
      }
    })

    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        status: OrderItemStatus.RUNNING,
        startedAt: new Date()
      }
    })

    await prisma.machine.update({
      where: { id: item.machineId },
      data: {
        status: MachineStatus.RUNNING,
        remainingMinutes: item.durationMinutes
      }
    })

    if (queue) {
      try {
        await queue.add('start-machine', payload, {
          jobId: item.id
        })
      } catch (error) {
        console.warn('queue add failed, command stored in database only', error)
      }
    }

    deviceCommandCounter.inc()
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.IN_PROGRESS
    }
  })

  await sendCustomerNotification({
    lineUserId: order.lineUserId,
    customerName: order.customerName,
    message: `Order ${order.orderNumber} started successfully`
  })
}

export async function completeOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          machine: true
        }
      }
    }
  })

  if (!order) {
    return
  }

  for (const item of order.items) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        status: OrderItemStatus.COMPLETED,
        completedAt: new Date()
      }
    })

    await prisma.machine.update({
      where: { id: item.machineId },
      data: {
        status: MachineStatus.AVAILABLE,
        remainingMinutes: null
      }
    })
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.COMPLETED
    }
  })

  await sendCustomerNotification({
    lineUserId: order.lineUserId,
    customerName: order.customerName,
    message: [
      'บริการเสร็จครบทุกเครื่องแล้ว',
      `Order: ${order.orderNumber}`,
      ...order.items.map(item => `• ${item.machine.name}`)
    ].join('\n')
  })
}

export async function reconcileRunningOrderItems() {
  const now = Date.now()
  const runningItems = await prisma.orderItem.findMany({
    where: {
      status: OrderItemStatus.RUNNING,
      startedAt: {
        not: null
      }
    },
    select: {
      id: true,
      orderId: true,
      machineId: true,
      durationMinutes: true,
      startedAt: true
    }
  })

  const touchedOrderIds = new Set<string>()
  for (const item of runningItems) {
    const startedAtMs = item.startedAt ? new Date(item.startedAt).getTime() : now
    const elapsedMinutes = Math.max(0, Math.floor((now - startedAtMs) / 60000))
    const remainingMinutes = Math.max(0, item.durationMinutes - elapsedMinutes)

    if (remainingMinutes <= 0) {
      await prisma.$transaction(async (tx) => {
        const freshItem = await tx.orderItem.findUnique({
          where: { id: item.id },
          select: { status: true, machineId: true, orderId: true }
        })

        if (!freshItem || freshItem.status !== OrderItemStatus.RUNNING) {
          return
        }

        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            status: OrderItemStatus.COMPLETED,
            completedAt: new Date()
          }
        })

        await tx.machine.update({
          where: { id: freshItem.machineId },
          data: {
            status: MachineStatus.AVAILABLE,
            remainingMinutes: null
          }
        })

        touchedOrderIds.add(freshItem.orderId)
      })
      continue
    }

    await prisma.machine.update({
      where: { id: item.machineId },
      data: {
        status: MachineStatus.RUNNING,
        remainingMinutes
      }
    })
  }

  for (const orderId of touchedOrderIds) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            machine: true
          }
        }
      }
    })

    if (!order) {
      continue
    }

    const allCompleted = order.items.length > 0 && order.items.every(entry => entry.status === OrderItemStatus.COMPLETED)
    if (!allCompleted || order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      continue
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.COMPLETED
      }
    })

    await sendCustomerNotification({
      lineUserId: order.lineUserId,
      customerName: order.customerName,
      message: [
        'บริการเสร็จครบทุกเครื่องแล้ว',
        `Order: ${order.orderNumber}`,
        ...order.items.map(entry => `• ${entry.machine.name}`)
      ].join('\n')
    })
  }
}
