import { createError, getRouterParam } from 'h3'
import type { OrderStatusView } from '~~/shared/types'
import { getMockOrder, getMockOrderByOrderNumber } from '../../../utils/mock-orders'
import { reconcileRunningOrderItems } from '../../../utils/order-workflow'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event): Promise<OrderStatusView> => {
  const key = getRouterParam(event, 'id')

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  try {
    await reconcileRunningOrderItems()

    const order = await prisma.order.findUnique({
      where: key.startsWith('ORD-') ? { orderNumber: key } : { id: key },
      include: {
        items: {
          include: {
            machine: true,
            asset: true
          }
        },
        payment: true
      }
    })

    if (!order || !order.payment) {
      throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      orderStatus: order.status,
      paymentStatus: order.payment.status,
      totalAmount: order.totalAmount,
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map(item => ({
        id: item.id,
        machineName: item.asset?.name || item.machine?.name || '-',
        durationMinutes: item.durationMinutes,
        amount: item.amount,
        status: item.status,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        remainingMinutes: item.machine?.remainingMinutes ?? null
      }))
    }
  } catch (error) {
    const mockOrder = key.startsWith('ORD-')
      ? await getMockOrderByOrderNumber(key)
      : await getMockOrder(key)

    if (!mockOrder) {
      throw error
    }

    return {
      id: mockOrder.id,
      orderNumber: mockOrder.orderNumber,
      customerName: mockOrder.customerName,
      orderStatus: mockOrder.status,
      paymentStatus: mockOrder.payment.status,
      totalAmount: mockOrder.totalAmount,
      updatedAt: mockOrder.updatedAt || mockOrder.createdAt || new Date().toISOString(),
      items: mockOrder.items.map(item => ({
        id: item.id,
        machineName: item.machine.name,
        durationMinutes: item.durationMinutes,
        amount: item.amount,
        status: item.status,
        startedAt: null,
        remainingMinutes: null
      }))
    }
  }
})
