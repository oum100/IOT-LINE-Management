import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { DeviceCommandStatus } from '@prisma/client'
import { prisma } from '../utils/prisma'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null
})

new Worker(
  'laundry-device-commands',
  async (job) => {
    const orderItemId = job.data.orderItemId as string

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true, machine: true }
    })

    if (!orderItem) {
      return
    }

    await prisma.deviceCommand.updateMany({
      where: {
        machineId: orderItem.machineId,
        orderId: orderItem.orderId,
        status: DeviceCommandStatus.PENDING
      },
      data: {
        status: DeviceCommandStatus.SENT,
        acknowledgedAt: new Date()
      }
    })

    console.info('Send command to IoT bridge here', {
      machineCode: orderItem.machine.code,
      durationMinutes: orderItem.durationMinutes,
      orderNumber: orderItem.order.orderNumber
    })
  },
  { connection }
)
