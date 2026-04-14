import { OrderItemStatus, OrderStatus, PaymentStatus, MachineStatus } from '@prisma/client'
import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { updateMockOrder } from '../../../utils/mock-orders'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  reason: z.string().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  const body = schema.parse(await readBody(event).catch(() => ({})))
  const reason = (body.reason || 'Cancelled by customer').trim()

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        items: true
      }
    })

    if (!order || !order.payment) {
      throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot cancel a completed order' })
    }

    const payment = order.payment
    const machineIds = Array.from(new Set(order.items.map(item => item.machineId)))

    await prisma.$transaction(async (tx) => {
      if (payment.status !== PaymentStatus.VERIFIED) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REJECTED,
            rejectedNote: reason
          }
        })
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED
        }
      })

      await tx.orderItem.updateMany({
        where: {
          orderId: order.id,
          status: {
            in: [OrderItemStatus.PENDING, OrderItemStatus.QUEUED, OrderItemStatus.RUNNING]
          }
        },
        data: {
          status: OrderItemStatus.FAILED,
          completedAt: new Date()
        }
      })

      if (machineIds.length) {
        await tx.machine.updateMany({
          where: {
            id: { in: machineIds }
          },
          data: {
            status: MachineStatus.AVAILABLE,
            remainingMinutes: null
          }
        })
      }
    })

    return {
      success: true,
      status: 'CANCELLED'
    }
  } catch (error) {
    const updated = await updateMockOrder(orderId, (order) => {
      if (order.status === 'COMPLETED' || order.status === 'IN_PROGRESS' || order.payment.status === 'VERIFIED') {
        return order
      }

      return {
        ...order,
        status: 'CANCELLED',
        items: order.items.map(item =>
          item.status === 'COMPLETED' ? item : { ...item, status: 'FAILED' }
        ),
        payment: {
          ...order.payment,
          status: 'REJECTED',
          rejectedNote: reason
        }
      }
    })

    if (!updated) {
      throw error
    }

    if (updated.status !== 'CANCELLED') {
      throw createError({ statusCode: 409, statusMessage: 'Cannot cancel this order' })
    }

    return {
      success: true,
      status: 'CANCELLED',
      mode: 'test'
    }
  }
})
