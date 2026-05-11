import { createError, getRouterParam } from 'h3'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

type TimelineEvent = {
  id: string
  at: Date | string | null
  title: string
  note: string
  tone: 'neutral' | 'primary' | 'success' | 'warning' | 'error'
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Payment id is required' })
  }

  const orm = prisma as any
  const payment = await orm.payment.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, code: true, name: true } },
      merchantAccount: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          totalAmount: true,
          status: true,
          createdAt: true
        }
      },
      slips: {
        orderBy: { uploadedAt: 'asc' }
      }
    }
  })

  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
  }

  const events: TimelineEvent[] = []

  if (payment.order) {
    events.push({
      id: `order-created-${payment.order.id}`,
      at: payment.order.createdAt,
      title: 'Order Created',
      note: `Order ${payment.order.orderNumber} created`,
      tone: 'primary'
    })
  }

  events.push({
    id: `payment-created-${payment.id}`,
    at: payment.createdAt,
    title: 'Payment Created',
    note: `Amount ${payment.amount}`,
    tone: 'neutral'
  })

  for (const slip of payment.slips) {
    events.push({
      id: `slip-uploaded-${slip.id}`,
      at: slip.uploadedAt,
      title: 'Slip Uploaded',
      note: slip.fileName || 'Awaiting review',
      tone: 'warning'
    })
  }

  if (payment.verifiedAt) {
    events.push({
      id: `payment-verified-${payment.id}`,
      at: payment.verifiedAt,
      title: 'Payment Verified',
      note: 'Payment verified successfully',
      tone: 'success'
    })
  } else if (payment.status === 'REJECTED') {
    events.push({
      id: `payment-rejected-${payment.id}`,
      at: payment.updatedAt,
      title: 'Payment Rejected',
      note: payment.rejectedNote || 'Rejected by system/admin',
      tone: 'error'
    })
  } else {
    events.push({
      id: `payment-status-${payment.id}`,
      at: payment.updatedAt,
      title: `Payment ${payment.status}`,
      note: 'Waiting for next payment action',
      tone: 'neutral'
    })
  }

  events.sort((a, b) => {
    const atA = a.at ? new Date(a.at).getTime() : 0
    const atB = b.at ? new Date(b.at).getTime() : 0
    return atA - atB
  })

  const traces = orm?.paymentTrace?.findMany
    ? await orm.paymentTrace.findMany({
        where: { paymentId: payment.id },
        orderBy: { createdAt: 'asc' }
      })
    : []

  return {
    payment: {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      providerCode: payment.providerCode,
      qrPayload: payment.qrPayload,
      providerReference: payment.providerReference,
      slipCount: payment.slips.length,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      verifiedAt: payment.verifiedAt,
      rejectedNote: payment.rejectedNote,
      tenant: payment.tenant,
      merchantAccount: payment.merchantAccount,
      branch: payment.branch,
      order: payment.order
    },
    events,
    traces: traces.map((trace: any) => ({
      id: trace.id,
      stage: trace.stage,
      direction: trace.direction,
      providerCode: trace.providerCode,
      statusCode: trace.statusCode,
      requestHeaders: trace.requestHeaders,
      requestBody: trace.requestBody,
      responseBody: trace.responseBody,
      mappedStatus: trace.mappedStatus,
      note: trace.note,
      createdAt: trace.createdAt
    }))
  }
})
