import { createError } from 'h3'

export const REFUND_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROCESSING', 'REJECTED'],
  PROCESSING: ['REFUNDED', 'FAILED'],
  FAILED: ['PROCESSING'],
  REFUNDED: [],
  REJECTED: []
}

export const REFUND_ACTION_TO_STATUS: Record<string, string> = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  PROCESS: 'PROCESSING',
  COMPLETE: 'REFUNDED',
  FAIL: 'FAILED'
}

export function assertRefundTransitionAllowed(fromStatus: string, toStatus: string) {
  const allowed = REFUND_TRANSITIONS[fromStatus] || []
  if (!allowed.includes(toStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid refund transition: ${fromStatus} -> ${toStatus}`
    })
  }
}

export async function addRefundAuditLog(
  tx: any,
  input: {
    refundId: string
    fromStatus?: string | null
    toStatus: string
    action: string
    actorUserId?: string | null
    note?: string | null
    providerRefundRef?: string | null
    metadata?: Record<string, unknown>
  }
) {
  await tx.refundAuditLog.create({
    data: {
      refundId: input.refundId,
      fromStatus: input.fromStatus || null,
      toStatus: input.toStatus,
      action: input.action,
      actorUserId: input.actorUserId || null,
      note: input.note || null,
      providerRefundRef: input.providerRefundRef || null,
      metadata: input.metadata || undefined
    }
  })
}
