import { Prisma } from '@prisma/client'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const bodySchema = z.object({
  tenantId: z.string().min(1),
  displayName: z.string().trim().min(2).max(120),
  providerCode: z.string().trim().min(2).max(40),
  providerServiceId: z.string().trim().min(1).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']),
  baseUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  appKey: z.string().trim().min(1).max(120).optional().nullable().or(z.literal('')),
  appSecret: z.string().trim().min(1).max(240).optional().nullable().or(z.literal('')),
  webhookSecret: z.string().trim().min(1).max(240).optional().nullable().or(z.literal('')),
  supportsQrIssue: z.coerce.boolean().default(false),
  supportsCallback: z.coerce.boolean().default(false),
  supportsSlipVerify: z.coerce.boolean().default(false),
  credentials: z.record(z.any()).optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing provider connection id' })
  const body = bodySchema.parse(await readBody(event))

  const [found, tenant] = await Promise.all([
    (prisma as any).providerConnection.findUnique({
      where: { id },
      select: { id: true }
    }),
    prisma.tenant.findUnique({
      where: { id: body.tenantId },
      select: { id: true }
    })
  ])

  if (!found) {
    throw createError({ statusCode: 404, statusMessage: 'Provider connection not found' })
  }

  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  const providerService = body.providerServiceId
    ? await (prisma as any).providerService?.findUnique?.({
        where: { id: body.providerServiceId },
        select: {
          id: true,
          tenantId: true,
          code: true,
          supportsQrGeneration: true,
          supportsConfirmCallback: true,
          supportsSingleTxnVerify: true,
          supportsSingleSlipVerify: true
        }
      })
    : null
  if (body.providerServiceId && (!providerService || (providerService.tenantId && providerService.tenantId !== body.tenantId))) {
    throw createError({ statusCode: 400, statusMessage: 'Selected provider service is invalid for this tenant' })
  }

  await (prisma as any).providerConnection.update({
    where: { id },
    data: {
      tenantId: body.tenantId,
      displayName: body.displayName,
      providerCode: (providerService?.code || body.providerCode).toUpperCase(),
      providerServiceId: providerService?.id || null,
      status: body.status,
      baseUrl: body.baseUrl || null,
      appKey: body.appKey || null,
      appSecret: body.appSecret || null,
      webhookSecret: body.webhookSecret || null,
      supportsQrIssue: providerService ? Boolean(providerService.supportsQrGeneration) : body.supportsQrIssue,
      supportsCallback: providerService ? Boolean(providerService.supportsConfirmCallback) : body.supportsCallback,
      supportsSlipVerify: providerService ? Boolean(providerService.supportsSingleSlipVerify || providerService.supportsSingleTxnVerify) : body.supportsSlipVerify,
      credentials: body.credentials && Object.keys(body.credentials).length ? body.credentials as Prisma.InputJsonValue : Prisma.JsonNull
    }
  })

  return { success: true }
})
