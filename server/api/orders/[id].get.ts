import { createError, getQuery, getRouterParam } from 'h3'
import { getMockOrder } from '../../utils/mock-orders'
import { getPaymentWindowState, isPaymentExpired, resolvePaymentExpiryMinutes } from '../../utils/payment-expiry'
import { prisma } from '../../utils/prisma'
import { updateMockOrder } from '../../utils/mock-orders'
import { MachineStatus, OrderItemStatus, OrderStatus, PaymentStatus } from '@prisma/client'
import { assertOrderBranchScope } from '../../utils/order-branch-scope'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const branchCode = typeof query.branchCode === 'string' ? query.branchCode : ''
  const expiryMinutes = await resolvePaymentExpiryMinutes(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  try {
    let order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            machine: true,
            asset: true
          }
        },
        payment: {
          include: {
            slips: {
              orderBy: { uploadedAt: 'desc' }
            }
          }
        }
      }
    })

    if (!order || !order.payment) {
      throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    }
    await assertOrderBranchScope(order.branchId, branchCode)

    const currentOrder = order
    const currentPayment = order.payment

    if (isPaymentExpired({
      createdAt: currentOrder.createdAt,
      orderStatus: currentOrder.status,
      paymentStatus: currentPayment.status
    }, expiryMinutes)) {
      const machineIds = Array.from(new Set(currentOrder.items.map(item => item.machineId).filter(Boolean) as string[]))

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            status: PaymentStatus.REJECTED,
            rejectedNote: 'Payment timeout expired'
          }
        })

        await tx.order.update({
          where: { id: currentOrder.id },
          data: {
            status: OrderStatus.CANCELLED
          }
        })

        await tx.orderItem.updateMany({
          where: {
            orderId: currentOrder.id,
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

      order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              machine: true,
              asset: true
            }
          },
          payment: {
            include: {
              slips: {
                orderBy: { uploadedAt: 'desc' }
              }
            }
          }
        }
      })

      if (!order || !order.payment) {
        throw createError({ statusCode: 404, statusMessage: 'Order not found after expiry update' })
      }
      await assertOrderBranchScope(order.branchId, branchCode)
    }

    return {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        machine: item.machine
          ? {
              ...item.machine,
              name: item.asset?.name || item.machine.name
            }
          : item.machine
      })),
      ...getPaymentWindowState({
        createdAt: order.createdAt,
        orderStatus: order.status,
        paymentStatus: order.payment.status
      }, expiryMinutes)
    }
  } catch (error) {
    const mockOrder = await getMockOrder(id)

    if (!mockOrder) {
      throw error
    }

    if (isPaymentExpired({
      createdAt: mockOrder.createdAt || new Date().toISOString(),
      orderStatus: mockOrder.status,
      paymentStatus: mockOrder.payment.status
    }, expiryMinutes)) {
      const expiredMockOrder = await updateMockOrder(id, (order) => ({
        ...order,
        status: 'CANCELLED',
        items: order.items.map(item =>
          item.status === 'COMPLETED' ? item : { ...item, status: 'FAILED' }
        ),
        payment: {
          ...order.payment,
          status: 'REJECTED',
          rejectedNote: 'Payment timeout expired'
        }
      }))

      if (expiredMockOrder) {
        return {
          ...expiredMockOrder,
          ...getPaymentWindowState({
            createdAt: expiredMockOrder.createdAt || new Date().toISOString(),
            orderStatus: expiredMockOrder.status,
            paymentStatus: expiredMockOrder.payment.status
          }, expiryMinutes)
        }
      }
    }

    return {
      ...mockOrder,
      ...getPaymentWindowState({
        createdAt: mockOrder.createdAt || new Date().toISOString(),
        orderStatus: mockOrder.status,
        paymentStatus: mockOrder.payment.status
      }, expiryMinutes)
    }
  }
})
