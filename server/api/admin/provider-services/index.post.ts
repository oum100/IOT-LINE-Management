import { readBody } from 'h3'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const bodySchema = z.object({
  tenantId: z.string().min(1).optional().nullable(),
  code: z.string().trim().min(2).max(40),
  displayName: z.string().trim().min(2).max(120),
  serviceType: z.enum(['PAYMENT_GATEWAY', 'SLIP_VERIFY', 'BANK_API']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']).default('ACTIVE'),
  supportsQrGeneration: z.coerce.boolean().default(false),
  supportsConfirmCallback: z.coerce.boolean().default(false),
  supportsSingleTxnVerify: z.coerce.boolean().default(false),
  supportsSingleSlipVerify: z.coerce.boolean().default(false),
  isDefault: z.coerce.boolean().default(false),
  metadata: z.record(z.any()).optional().nullable()
})

async function generateCode(displayName: string) {
  const prefix = displayName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 12) || 'PROVIDER'
  return `${prefix}_${nanoid(4).toUpperCase()}`
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = bodySchema.parse(await readBody(event))
  const orm = prisma as any

  const code = (body.code || await generateCode(body.displayName)).toUpperCase()
  const exists = await orm.providerService.findFirst({
    where: { tenantId: body.tenantId || null, code },
    select: { id: true }
  })
  if (exists) throw createError({ statusCode: 409, statusMessage: 'Provider service code already exists' })

  const created = await orm.providerService.create({
    data: {
      tenantId: body.tenantId || null,
      code,
      displayName: body.displayName,
      serviceType: body.serviceType,
      status: body.status,
      supportsQrGeneration: body.supportsQrGeneration,
      supportsConfirmCallback: body.supportsConfirmCallback,
      supportsSingleTxnVerify: body.supportsSingleTxnVerify,
      supportsSingleSlipVerify: body.supportsSingleSlipVerify,
      isDefault: body.isDefault,
      metadata: body.metadata && Object.keys(body.metadata).length ? body.metadata : null
    },
    select: { id: true }
  })

  return { success: true, id: created.id }
})
