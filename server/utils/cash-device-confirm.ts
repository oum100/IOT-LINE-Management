import { OrderStatus, PaymentStatus } from '@prisma/client'
import { createError } from 'h3'
import { prisma } from './prisma'
import { logPaymentTrace } from './payment-trace'
import { startOrderMachines } from './order-workflow'

export type CashDeviceConfirmInput = {
  orderId?: string | null
  orderNumber?: string | null
  paymentId?: string | null
  deviceEventRef?: string | null
  amountPaid?: number | null
  source?: string | null
  payload?: unknown
  headers?: unknown
}

export async function confirmCashDevicePayment(input: CashDeviceConfirmInput) {
  const orderId = String(input.orderId || '').trim()
  const orderNumber = String(input.orderNumber || '').trim()
  const paymentId = String(input.paymentId || '').trim()
  const deviceEventRef = String(input.deviceEventRef || '').trim()
  const amountPaid = Number.isFinite(input.amountPaid as number) ? Number(input.amountPaid) : null

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        paymentId ? { id: paymentId } : undefined,
        orderId ? { orderId } : undefined,
        orderNumber ? { order: { orderNumber } } : undefined
      ].filter(Boolean) as any
    },
    include: {
      order: {
        include: {
          items: {
            select: { machineId: true }
          }
        }
      }
    }
  })

  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: 'Payment not found for cash device event' })
  }

  if (payment.order.status === OrderStatus.CANCELLED) {
    throw createError({ statusCode: 409, statusMessage: 'Order is cancelled' })
  }

  if (deviceEventRef && payment.deviceEventRef === deviceEventRef && payment.status === PaymentStatus.VERIFIED) {
    return { ok: true, idempotent: true, paymentId: payment.id, orderId: payment.orderId }
  }

  if (payment.status === PaymentStatus.VERIFIED && payment.order.status !== OrderStatus.CANCELLED) {
    return { ok: true, idempotent: true, paymentId: payment.id, orderId: payment.orderId }
  }

  if (amountPaid !== null && amountPaid < Number(payment.amount || 0)) {
    throw createError({ statusCode: 409, statusMessage: 'Cash amount is less than order amount' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        paymentMethod: 'CASH_DEVICE',
        status: PaymentStatus.VERIFIED,
        verifiedAt: new Date(),
        rejectedNote: null,
        deviceEventRef: deviceEventRef || payment.deviceEventRef || null
      }
    })

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.CONFIRMED }
    })
  })

  await logPaymentTrace({
    paymentId: payment.id,
    orderId: payment.orderId,
    stage: 'CASH_DEVICE_CONFIRM',
    direction: 'INBOUND',
    providerCode: payment.providerCode || 'CASH_DEVICE',
    requestHeaders: input.headers || null,
    requestBody: input.payload || null,
    responseBody: {
      source: input.source || 'device',
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
      paymentId: payment.id,
      amountPaid
    },
    mappedStatus: 'PAID',
    note: 'Cash payment confirmed by device event'
  })

  await startOrderMachines(payment.orderId)

  return { ok: true, idempotent: false, paymentId: payment.id, orderId: payment.orderId }
}
