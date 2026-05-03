import { MachineStatus, OrderItemStatus, OrderStatus, PaymentStatus } from '@prisma/client'
import { createError, getHeader, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { startOrderMachines } from '../../utils/order-workflow'

const callbackSchema = z.object({
  providerCode: z.string().trim().min(1).optional(),
  providerPaymentIntentId: z.string().trim().min(1).optional(),
  providerReference: z.string().trim().min(1).optional(),
  orderNumber: z.string().trim().min(1).optional(),
  amount: z.coerce.number().int().min(0).optional(),
  status: z.string().trim().min(1).optional()
})

function normalizeStatus(value?: string | null) {
  const status = String(value || '').trim().toUpperCase()
  if (['PAID', 'VERIFIED', 'SUCCESS', 'COMPLETED'].includes(status)) return 'PAID'
  if (['FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(status)) return 'FAILED'
  return 'UNKNOWN'
}

function getByPath(input: unknown, path?: string | null) {
  if (!path || typeof path !== 'string') return undefined
  const keys = path.split('.').map((item) => item.trim()).filter(Boolean)
  let cursor: any = input
  for (const key of keys) {
    if (!cursor || typeof cursor !== 'object') return undefined
    cursor = cursor[key]
  }
  return cursor
}

function asString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function arrayOfUpperString(input: unknown) {
  if (!Array.isArray(input)) return []
  return input.map((item) => asString(item).toUpperCase()).filter(Boolean)
}

function parseFromMapping(rawBody: unknown, credentials: Record<string, unknown> | null) {
  const callbackMapping = credentials && typeof credentials.callbackMapping === 'object'
    ? credentials.callbackMapping as Record<string, unknown>
    : null
  const lookup = callbackMapping && typeof callbackMapping.lookup === 'object'
    ? callbackMapping.lookup as Record<string, unknown>
    : null
  const statusMap = callbackMapping && typeof callbackMapping.status === 'object'
    ? callbackMapping.status as Record<string, unknown>
    : null

  const providerPaymentIntentId = asString(getByPath(rawBody, asString(lookup?.providerPaymentIntentIdPath)))
  const providerReference = asString(getByPath(rawBody, asString(lookup?.providerReferencePath)))
  const orderNumber = asString(getByPath(rawBody, asString(lookup?.orderNumberPath)))
  const providerCode = asString(getByPath(rawBody, asString(callbackMapping?.providerCodePath)))
  const amount = asNumber(getByPath(rawBody, asString(callbackMapping?.amountPath)))
  const rejectNote = asString(getByPath(rawBody, asString(callbackMapping?.rejectNotePath)))
  const rawStatus = asString(getByPath(rawBody, asString(statusMap?.path)))

  const successValues = arrayOfUpperString(statusMap?.successValues)
  const failedValues = arrayOfUpperString(statusMap?.failedValues)
  const rawUpper = rawStatus.toUpperCase()

  const normalizedStatus = successValues.includes(rawUpper)
    ? 'PAID'
    : failedValues.includes(rawUpper)
      ? 'FAILED'
      : normalizeStatus(rawStatus)

  return {
    providerPaymentIntentId,
    providerReference,
    orderNumber,
    providerCode,
    amount,
    rejectNote,
    rawStatus,
    normalizedStatus
  }
}

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event).catch(() => ({}))
  const body = callbackSchema.parse(rawBody)
  const webhookSecret = String(getHeader(event, 'x-webhook-secret') || getHeader(event, 'x-provider-webhook-secret') || '').trim()
  const authorization = String(getHeader(event, 'authorization') || '').trim()
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''

  let payment = await prisma.payment.findFirst({
    where: {
      OR: [
        body.providerPaymentIntentId ? { providerPaymentIntentId: body.providerPaymentIntentId } : undefined,
        body.providerReference ? { providerReference: body.providerReference } : undefined,
        body.orderNumber ? { order: { orderNumber: body.orderNumber } } : undefined
      ].filter(Boolean) as any
    },
    include: {
      order: {
        include: {
          items: {
            select: { machineId: true, status: true }
          }
        }
      },
      billerProfile: {
        include: {
          providerConnection: true
        }
      }
    }
  })

  let mapped = {
    providerPaymentIntentId: body.providerPaymentIntentId || '',
    providerReference: body.providerReference || '',
    orderNumber: body.orderNumber || '',
    providerCode: body.providerCode || '',
    amount: body.amount,
    rejectNote: '',
    rawStatus: body.status || '',
    normalizedStatus: normalizeStatus(body.status)
  }

  if (!payment) {
    const connections = await (prisma as any).providerConnection.findMany({
      where: { supportsCallback: true, status: 'ACTIVE' },
      select: { id: true, credentials: true, webhookSecret: true }
    })

    for (const connection of connections as Array<{ id: string; credentials: Record<string, unknown> | null; webhookSecret: string | null }>) {
      const parsed = parseFromMapping(rawBody, connection.credentials || null)
      if (!parsed.providerPaymentIntentId && !parsed.providerReference && !parsed.orderNumber) {
        continue
      }
      const found = await prisma.payment.findFirst({
        where: {
          billerProfile: {
            providerConnectionId: connection.id
          },
          OR: [
            parsed.providerPaymentIntentId ? { providerPaymentIntentId: parsed.providerPaymentIntentId } : undefined,
            parsed.providerReference ? { providerReference: parsed.providerReference } : undefined,
            parsed.orderNumber ? { order: { orderNumber: parsed.orderNumber } } : undefined
          ].filter(Boolean) as any
        },
        include: {
          order: {
            include: {
              items: {
                select: { machineId: true, status: true }
              }
            }
          },
          billerProfile: {
            include: {
              providerConnection: true
            }
          }
        }
      })
      if (found) {
        payment = found
        mapped = parsed
        break
      }
    }
  }

  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: 'Payment not found for callback payload' })
  }

  const expectedSecret = payment.billerProfile?.providerConnection?.webhookSecret || ''
  if (expectedSecret) {
    const incoming = webhookSecret || bearer
    if (!incoming || incoming !== expectedSecret) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid provider webhook secret' })
    }
  }

  const fallbackMapped = parseFromMapping(rawBody, (payment.billerProfile?.providerConnection?.credentials || null) as Record<string, unknown> | null)
  if (fallbackMapped.providerPaymentIntentId || fallbackMapped.providerReference || fallbackMapped.orderNumber || fallbackMapped.rawStatus) {
    mapped = {
      ...mapped,
      ...fallbackMapped,
      providerPaymentIntentId: fallbackMapped.providerPaymentIntentId || mapped.providerPaymentIntentId,
      providerReference: fallbackMapped.providerReference || mapped.providerReference,
      orderNumber: fallbackMapped.orderNumber || mapped.orderNumber,
      providerCode: fallbackMapped.providerCode || mapped.providerCode,
      amount: fallbackMapped.amount ?? mapped.amount,
      rejectNote: fallbackMapped.rejectNote || mapped.rejectNote,
      rawStatus: fallbackMapped.rawStatus || mapped.rawStatus,
      normalizedStatus: fallbackMapped.normalizedStatus || mapped.normalizedStatus
    }
  }

  const normalizedStatus = mapped.normalizedStatus
  const ackConfig =
    payment.billerProfile?.providerConnection?.credentials &&
    typeof payment.billerProfile.providerConnection.credentials === 'object' &&
    (payment.billerProfile.providerConnection.credentials as any).ackConfig &&
    typeof (payment.billerProfile.providerConnection.credentials as any).ackConfig === 'object'
      ? (payment.billerProfile.providerConnection.credentials as any).ackConfig as Record<string, unknown>
      : null
  const ackStatusCode = Number(ackConfig?.statusCode || 200)
  const ackBody = ackConfig?.body && typeof ackConfig.body === 'object' ? ackConfig.body as Record<string, unknown> : { success: true }
  const reply = (body: Record<string, unknown>) => {
    setResponseStatus(event, Number.isFinite(ackStatusCode) ? ackStatusCode : 200)
    return {
      ...ackBody,
      ...body
    }
  }

  if (normalizedStatus === 'UNKNOWN') {
    return reply({ success: true, ignored: true, reason: 'unsupported status' })
  }

  if (normalizedStatus === 'PAID') {
    if (payment.status === PaymentStatus.VERIFIED && payment.order.status !== OrderStatus.CANCELLED) {
      return reply({ success: true, idempotent: true })
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VERIFIED,
          verifiedAt: new Date(),
          rejectedNote: null,
          providerCode: mapped.providerCode || payment.providerCode || null,
          providerPaymentIntentId: mapped.providerPaymentIntentId || payment.providerPaymentIntentId || null,
          providerReference: mapped.providerReference || payment.providerReference || null
        }
      })

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.CONFIRMED }
      })
    })

    await startOrderMachines(payment.orderId)

    return reply({ success: true, status: 'VERIFIED' })
  }

  if (payment.order.status === OrderStatus.CANCELLED) {
    return reply({ success: true, idempotent: true })
  }

  const machineIds = Array.from(new Set(payment.order.items.map((item) => item.machineId)))

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REJECTED,
        rejectedNote: mapped.rejectNote || mapped.rawStatus || 'Rejected by provider callback',
        providerCode: mapped.providerCode || payment.providerCode || null,
        providerPaymentIntentId: mapped.providerPaymentIntentId || payment.providerPaymentIntentId || null,
        providerReference: mapped.providerReference || payment.providerReference || null
      }
    })

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.CANCELLED }
    })

    await tx.orderItem.updateMany({
      where: {
        orderId: payment.orderId,
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

  return reply({ success: true, status: 'REJECTED' })
})
