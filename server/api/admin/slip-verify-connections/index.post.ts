import { Prisma } from '@prisma/client'
import { readBody } from 'h3'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const bodySchema = z.object({
  tenantId: z.string().min(1),
  displayName: z.string().trim().min(2).max(120),
  providerCode: z.string().trim().min(2).max(40),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']).default('ACTIVE'),
  baseUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  appKey: z.string().trim().min(1).max(120).optional().nullable().or(z.literal('')),
  appSecret: z.string().trim().min(1).max(240).optional().nullable().or(z.literal('')),
  webhookSecret: z.string().trim().min(1).max(240).optional().nullable().or(z.literal('')),
  credentials: z.record(z.any()).optional().nullable()
})

function buildPrefix(name: string) {
  const chunks = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (chunks.length > 1) return chunks.slice(0, 3).map(c => c[0]).join('').slice(0, 3) || 'SVC'
  return (chunks[0] || 'SVC').slice(0, 3)
}

async function generateCode(tenantId: string, displayName: string) {
  const prefix = buildPrefix(displayName)
  for (let i = 0; i < 12; i += 1) {
    const code = `${prefix}_${nanoid(5).toUpperCase()}`
    const exists = await (prisma as any).slipVerifyConnection.findFirst({
      where: { tenantId, code },
      select: { id: true }
    })
    if (!exists) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'Failed to generate connection code' })
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = bodySchema.parse(await readBody(event))

  const tenant = await prisma.tenant.findUnique({
    where: { id: body.tenantId },
    select: { id: true }
  })

  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  const code = await generateCode(body.tenantId, body.displayName)

  const created = await (prisma as any).slipVerifyConnection.create({
    data: {
      tenantId: body.tenantId,
      code,
      displayName: body.displayName,
      providerCode: body.providerCode.toUpperCase(),
      status: body.status,
      baseUrl: body.baseUrl || null,
      appKey: body.appKey || null,
      appSecret: body.appSecret || null,
      webhookSecret: body.webhookSecret || null,
      credentials: body.credentials && Object.keys(body.credentials).length ? body.credentials as Prisma.InputJsonValue : Prisma.JsonNull
    },
    select: { id: true }
  })

  return {
    success: true,
    id: created.id
  }
})
