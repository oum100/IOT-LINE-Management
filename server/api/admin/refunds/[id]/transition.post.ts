import { getServerSession } from '#auth'
import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import { REFUND_ACTION_TO_STATUS, addRefundAuditLog, assertRefundTransitionAllowed } from '../../../../utils/refund-workflow'

const bodySchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'PROCESS', 'COMPLETE', 'FAIL']),
  note: z.string().optional(),
  providerRefundRef: z.string().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const session = await getServerSession(event)
  const actorId = (session?.user as { id?: string } | undefined)?.id || null

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Refund id is required' })
  }

  const body = bodySchema.parse(await readBody(event))
  const nextStatus = REFUND_ACTION_TO_STATUS[body.action]
  if (!nextStatus) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid refund action' })
  }

  if (body.action === 'COMPLETE' && !String(body.providerRefundRef || '').trim()) {
    throw createError({ statusCode: 400, statusMessage: 'providerRefundRef is required for COMPLETE action' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.refund.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            payment: {
              select: { id: true, status: true, amount: true }
            }
          }
        },
        items: {
          select: {
            amount: true
          }
        }
      }
    })

    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Refund not found' })
    }

    assertRefundTransitionAllowed(current.status, nextStatus)

    const totalByItems = current.items.reduce((sum: number, item: { amount: number }) => sum + Number(item.amount || 0), 0)
    if (totalByItems !== Number(current.totalAmount || 0)) {
      throw createError({ statusCode: 400, statusMessage: 'Refund amount mismatch detected' })
    }

    const note = body.note?.trim() || null
    const providerRefundRef = body.providerRefundRef?.trim() || null

    const updatedRefund = await tx.refund.update({
      where: { id: current.id },
      data: {
        status: nextStatus as any,
        ...(body.action === 'APPROVE'
          ? {
              approvedByUserId: actorId,
              approvedAt: new Date()
            }
          : {}),
        ...(providerRefundRef ? { providerRefundRef } : {})
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
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    await addRefundAuditLog(tx, {
      refundId: current.id,
      fromStatus: current.status,
      toStatus: nextStatus,
      action: body.action,
      actorUserId: actorId,
      note,
      providerRefundRef,
      metadata: {
        orderId: current.orderId,
        paymentStatus: current.order?.payment?.status || null,
        paymentAmount: current.order?.payment?.amount || null
      }
    })

    return updatedRefund
  })

  return updated
})
