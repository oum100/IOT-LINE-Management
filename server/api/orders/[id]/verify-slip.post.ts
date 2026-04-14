import { MachineStatus, OrderItemStatus, OrderStatus, PaymentStatus } from '@prisma/client'
import { createError, getRouterParam, readBody } from 'h3'
import { updateMockOrder } from '../../../utils/mock-orders'
import { sendCustomerNotification, sendOrderReceiptCardNotification } from '../../../utils/notifications'
import { startOrderMachines } from '../../../utils/order-workflow'
import { prisma } from '../../../utils/prisma'
import { verifySlipSchema } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  const body = verifySlipSchema.parse(await readBody(event))
  try {
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: true
      }
    })

    if (!payment) {
      throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
    }

    if (payment.order.status === OrderStatus.CANCELLED) {
      throw createError({ statusCode: 409, statusMessage: 'Order is cancelled' })
    }

    let order

    if (body.approved) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VERIFIED,
          verifiedAt: new Date(),
          rejectedNote: null
        }
      })

      order = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED
        }
      })
    } else {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId },
        select: { machineId: true }
      })
      const machineIds = Array.from(new Set(orderItems.map(item => item.machineId)))

      order = await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REJECTED,
            rejectedNote: body.note || 'Rejected by reviewer'
          }
        })

        const cancelledOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CANCELLED
          }
        })

        await tx.orderItem.updateMany({
          where: {
            orderId,
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

        return cancelledOrder
      })
    }

    if (body.approved) {
      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              machine: true
            }
          }
        }
      })

      if (fullOrder) {
        await sendOrderReceiptCardNotification({
          lineUserId: fullOrder.lineUserId,
          customerName: fullOrder.customerName || 'คุณลูกค้า',
          orderId: fullOrder.id,
          orderNumber: fullOrder.orderNumber,
          totalAmount: fullOrder.totalAmount,
          items: fullOrder.items.map(item => ({
            machineName: item.machine.name,
            durationMinutes: item.durationMinutes,
            amount: item.amount
          }))
        })
      } else {
        await sendCustomerNotification({
          lineUserId: null,
          customerName: 'คุณลูกค้า',
          message: `Payment verified for ${order.id}. Starting service now.`
        })
      }

      await startOrderMachines(orderId)
    }
  } catch (error) {
    const updated = await updateMockOrder(orderId, (order) => ({
      ...order,
      status: body.approved ? 'IN_PROGRESS' : 'CANCELLED',
      items: order.items.map(item => ({
        ...item,
        status: body.approved ? 'RUNNING' : (item.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED')
      })),
      payment: {
        ...order.payment,
        status: body.approved ? 'VERIFIED' : 'REJECTED',
        rejectedNote: body.approved ? 'MANUAL_VERIFY: Approved in test mode' : (body.note || 'MANUAL_VERIFY: Rejected in test mode')
      }
    }))

    if (!updated) {
      throw error
    }

    if (body.approved) {
      await sendCustomerNotification({
        lineUserId: updated.lineUserId,
        customerName: updated.customerName,
        message: `Payment verified for ${updated.orderNumber}. Starting service now.`
      })
    }
  }

  return {
    success: true,
    reviewer: body.reviewer
  }
})
