import { getRouterParam } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { assertAdminAccess } from '../../../../../utils/admin-auth'

const countableStatuses = [
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'REFUNDED'
]

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Order id is required' })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      payment: {
        select: {
          id: true,
          status: true,
          amount: true
        }
      },
      items: {
        select: {
          id: true,
          priceLabel: true,
          amount: true,
          status: true
        },
        orderBy: { id: 'asc' }
      }
    }
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  const refunds = await prisma.refund.findMany({
    where: { orderId: order.id },
    include: {
      items: {
        include: {
          orderItem: {
            select: {
              id: true,
              priceLabel: true,
              amount: true
            }
          }
        }
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const refundedRows = await prisma.refundItem.findMany({
    where: {
      orderItemId: { in: order.items.map(item => item.id) },
      refund: {
        status: { in: countableStatuses }
      }
    },
    select: {
      orderItemId: true,
      amount: true
    }
  })

  const refundedMap = new Map<string, number>()
  for (const row of refundedRows) {
    refundedMap.set(row.orderItemId, (refundedMap.get(row.orderItemId) || 0) + Number(row.amount || 0))
  }

  return {
    order,
    refundableItems: order.items.map((item) => {
      const refunded = Number(refundedMap.get(item.id) || 0)
      const total = Number(item.amount || 0)
      return {
        id: item.id,
        label: item.priceLabel,
        amount: total,
        refunded,
        remaining: Math.max(0, total - refunded),
        status: item.status
      }
    }),
    refunds
  }
})
