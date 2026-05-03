import { Prisma } from '@prisma/client'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const bodySchema = z.object({
  tenantId: z.string().min(1),
  displayName: z.string().trim().min(2).max(120),
  providerCode: z.string().trim().min(2).max(40),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']),
  baseUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  appKey: z.string().trim().min(1).max(120).optional().nullable().or(z.literal('')),
  appSecret: z.string().trim().min(1).max(240).optional().nullable().or(z.literal('')),
  webhookSecret: z.string().trim().min(1).max(240).optional().nullable().or(z.literal('')),
  credentials: z.record(z.any()).optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing connection id' })
  const body = bodySchema.parse(await readBody(event))

  const [found, tenant] = await Promise.all([
    (prisma as any).slipVerifyConnection.findUnique({
      where: { id },
      select: { id: true }
    }),
    prisma.tenant.findUnique({
      where: { id: body.tenantId },
      select: { id: true }
    })
  ])

  if (!found) {
    throw createError({ statusCode: 404, statusMessage: 'Slip verify connection not found' })
  }
  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  await (prisma as any).slipVerifyConnection.update({
    where: { id },
    data: {
      tenantId: body.tenantId,
      displayName: body.displayName,
      providerCode: body.providerCode.toUpperCase(),
      status: body.status,
      baseUrl: body.baseUrl || null,
      appKey: body.appKey || null,
      appSecret: body.appSecret || null,
      webhookSecret: body.webhookSecret || null,
      credentials: body.credentials && Object.keys(body.credentials).length ? body.credentials as Prisma.InputJsonValue : Prisma.JsonNull
    }
  })

  return { success: true }
})
