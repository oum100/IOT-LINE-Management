import { getServerSession } from '#auth'
import { RefundStatus } from '@prisma/client'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { addRefundAuditLog } from '../../../utils/refund-workflow'

const bodySchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().min(3),
  note: z.string().optional(),
  items: z.array(z.object({
    orderItemId: z.string().min(1),
    amount: z.coerce.number().int().positive(),
    reason: z.string().optional()
  })).min(1)
})

const countableStatuses: RefundStatus[] = ['REQUESTED', 'APPROVED', 'PROCESSING', 'REFUNDED']

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const session = await getServerSession(event)
  const actorId = (session?.user as { id?: string } | undefined)?.id || null

  const body = bodySchema.parse(await readBody(event))

  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: {
      payment: { select: { id: true, status: true } },
      items: {
        select: {
          id: true,
          amount: true,
          priceLabel: true
        }
      }
    }
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  if (!order.payment || order.payment.status !== 'VERIFIED') {
    throw createError({ statusCode: 400, statusMessage: 'Refund is allowed only for VERIFIED payments' })
  }

  const inputItemIds = Array.from(new Set(body.items.map(item => item.orderItemId)))
  const orderItemMap = new Map(order.items.map(item => [item.id, item]))

  for (const itemId of inputItemIds) {
    if (!orderItemMap.has(itemId)) {
      throw createError({ statusCode: 400, statusMessage: `Order item ${itemId} does not belong to this order` })
    }
  }

  const existing = await prisma.refundItem.findMany({
    where: {
      orderItemId: { in: inputItemIds },
      refund: { status: { in: countableStatuses } }
    },
    select: {
      orderItemId: true,
      amount: true
    }
  })

  const alreadyRefunded = new Map<string, number>()
  for (const row of existing) {
    alreadyRefunded.set(row.orderItemId, (alreadyRefunded.get(row.orderItemId) || 0) + Number(row.amount || 0))
  }

  for (const item of body.items) {
    const orderItem = orderItemMap.get(item.orderItemId)
    if (!orderItem) continue
    const used = Number(alreadyRefunded.get(item.orderItemId) || 0)
    const remaining = Number(orderItem.amount || 0) - used
    if (item.amount > remaining) {
      throw createError({
        statusCode: 400,
        statusMessage: `Refund amount exceeds remaining amount for item ${orderItem.priceLabel}. Remaining: ${remaining}`
      })
    }
  }

  const totalAmount = body.items.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const created = await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        paymentId: order.payment?.id || null,
        tenantId: order.tenantId || null,
        merchantAccountId: order.merchantAccountId || null,
        branchId: order.branchId || null,
        status: 'REQUESTED',
        reason: body.reason,
        note: body.note,
        totalAmount,
        requestedByUserId: actorId,
        items: {
          create: body.items.map(item => ({
            orderItemId: item.orderItemId,
            amount: item.amount,
            reason: item.reason
          }))
        }
      },
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
        }
      }
    })

    await addRefundAuditLog(tx, {
      refundId: refund.id,
      fromStatus: null,
      toStatus: 'REQUESTED',
      action: 'CREATE_REQUEST',
      actorUserId: actorId,
      note: body.note || body.reason || null,
      metadata: {
        itemCount: body.items.length,
        totalAmount
      }
    })

    return refund
  })

  return created
})
