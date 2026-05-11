import { OrderStatus, PaymentStatus } from '@prisma/client'
import type { H3Event } from 'h3'
import { getPaymentExpiryMinutesSetting } from './admin-settings'

type ExpiryContext = {
  createdAt: Date | string
  orderStatus: string
  paymentStatus: string
}

const PAYMENT_PENDING_ORDER_STATUSES = new Set<string>([
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.SLIP_UPLOADED
])

export async function resolvePaymentExpiryMinutes(event: H3Event) {
  const config = useRuntimeConfig(event)
  const base = Number(config.paymentExpiryMinutes || 15)

  try {
    const custom = await getPaymentExpiryMinutesSetting(NaN)

    if (Number.isFinite(custom) && custom >= 1 && custom <= 1440) {
      return custom
    }
  } catch {
    // Fallback to runtime config.
  }

  return Number.isFinite(base) && base >= 1 ? base : 15
}

export function getPaymentDeadlineAt(createdAt: Date | string, expiryMinutes: number) {
  const created = new Date(createdAt)
  return new Date(created.getTime() + expiryMinutes * 60 * 1000)
}

export function isPaymentExpired(input: ExpiryContext, expiryMinutes: number) {
  if (!PAYMENT_PENDING_ORDER_STATUSES.has(input.orderStatus)) {
    return false
  }

  if (input.paymentStatus === PaymentStatus.VERIFIED) {
    return false
  }

  const deadlineAt = getPaymentDeadlineAt(input.createdAt, expiryMinutes)
  return Date.now() > deadlineAt.getTime()
}

export function getPaymentWindowState(input: ExpiryContext, expiryMinutes: number) {
  const deadlineAt = getPaymentDeadlineAt(input.createdAt, expiryMinutes)
  const msLeft = deadlineAt.getTime() - Date.now()
  const secondsLeft = Math.max(0, Math.floor(msLeft / 1000))
  const expired = isPaymentExpired(input, expiryMinutes)
  const canCancel =
    !expired &&
    PAYMENT_PENDING_ORDER_STATUSES.has(input.orderStatus) &&
    input.paymentStatus !== PaymentStatus.VERIFIED

  return {
    paymentExpiryMinutes: expiryMinutes,
    paymentDeadlineAt: deadlineAt.toISOString(),
    paymentSecondsLeft: secondsLeft,
    paymentExpired: expired,
    canCancel
  }
}
