import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const bodySchema = z.object({
  tenantId: z.string().min(1).optional().nullable(),
  code: z.string().trim().min(2).max(40),
  displayName: z.string().trim().min(2).max(120),
  serviceType: z.enum(['PAYMENT_GATEWAY', 'SLIP_VERIFY', 'BANK_API']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']),
  supportsQrGeneration: z.coerce.boolean().default(false),
  supportsConfirmCallback: z.coerce.boolean().default(false),
  supportsSingleTxnVerify: z.coerce.boolean().default(false),
  supportsSingleSlipVerify: z.coerce.boolean().default(false),
  isDefault: z.coerce.boolean().default(false),
  metadata: z.record(z.any()).optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing provider service id' })
  const body = bodySchema.parse(await readBody(event))
  const orm = prisma as any

  const found = await orm.providerService.findUnique({ where: { id }, select: { id: true } })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Provider service not found' })

  const code = body.code.toUpperCase()
  const duplicated = await orm.providerService.findFirst({
    where: { tenantId: body.tenantId || null, code, id: { not: id } },
    select: { id: true }
  })
  if (duplicated) throw createError({ statusCode: 409, statusMessage: 'Provider service code already exists' })

  await orm.providerService.update({
    where: { id },
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
    }
  })
  return { success: true }
})
