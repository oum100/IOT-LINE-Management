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
  integrationMode: z.enum(['PLATFORM_QR', 'PROVIDER_QR']).default('PLATFORM_QR'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']).default('ACTIVE'),
  priority: z.coerce.number().int().min(1).max(999).default(100),
  billerId: z.string().trim().min(2).max(80).optional().nullable(),
  providerConnectionId: z.string().trim().min(1).optional().nullable(),
  accountName: z.string().trim().min(2).max(120).optional().nullable(),
  bankName: z.string().trim().min(2).max(120).optional().nullable(),
  accountNumber: z.string().trim().min(4).max(40).optional().nullable(),
  promptPayTarget: z.string().trim().min(6).max(40).optional().nullable(),
  slipVerifyConnectionId: z.string().trim().min(1).optional().nullable(),
  qrPaymentMode: z.enum(['promptpay', 'maemanee', 'maemanee_template']).optional().nullable(),
  maeManeeShopId: z.string().trim().min(2).max(80).optional().nullable(),
  merchantIds: z.array(z.string().min(1)).default([]),
  branchIds: z.array(z.string().min(1)).default([])
})

function buildPrefix(name: string) {
  const chunks = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (chunks.length > 1) return chunks.slice(0, 3).map(c => c[0]).join('').slice(0, 3) || 'BLR'
  return (chunks[0] || 'BLR').slice(0, 3)
}

async function generateBillerCode(tenantId: string, displayName: string) {
  const prefix = buildPrefix(displayName)
  for (let i = 0; i < 12; i += 1) {
    const code = `${prefix}_${nanoid(5).toUpperCase()}`
    const exists = await prisma.billerProfile.findFirst({
      where: { tenantId, code },
      select: { id: true }
    })
    if (!exists) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'Failed to generate biller code' })
}

function buildConfig(body: z.infer<typeof bodySchema>) {
  const config: Record<string, unknown> = {}
  if (body.integrationMode === 'PLATFORM_QR') {
    if (body.qrPaymentMode) config.qrPaymentMode = body.qrPaymentMode
    if (body.maeManeeShopId) config.maeManeeShopId = body.maeManeeShopId
  }
  return Object.keys(config).length ? config : null
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = bodySchema.parse(await readBody(event))

  const [tenant, merchants, branches, slipVerifyConnection, providerConnection] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: body.tenantId },
      select: { id: true }
    }),
    body.merchantIds.length
      ? prisma.merchantAccount.findMany({
          where: { id: { in: body.merchantIds }, tenantId: body.tenantId },
          select: { id: true }
        })
      : Promise.resolve([]),
    body.branchIds.length
      ? prisma.branch.findMany({
          where: { id: { in: body.branchIds }, tenantId: body.tenantId },
          select: { id: true }
        })
      : Promise.resolve([]),
    body.slipVerifyConnectionId
      ? (prisma as any).slipVerifyConnection?.findUnique?.({
          where: { id: body.slipVerifyConnectionId },
          select: { id: true, tenantId: true }
        }) || Promise.resolve(null)
      : Promise.resolve(null),
    body.providerConnectionId
      ? (prisma as any).providerConnection?.findUnique?.({
          where: { id: body.providerConnectionId },
          select: { id: true, tenantId: true }
        }) || Promise.resolve(null)
      : Promise.resolve(null)
  ])

  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  if (merchants.length !== body.merchantIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Some selected merchants are invalid for this tenant' })
  }

  if (branches.length !== body.branchIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Some selected branches are invalid for this tenant' })
  }

  if (body.slipVerifyConnectionId && (!slipVerifyConnection || slipVerifyConnection.tenantId !== body.tenantId)) {
    throw createError({ statusCode: 400, statusMessage: 'Selected slip verify connection is invalid for this tenant' })
  }

  if (body.providerConnectionId && (!providerConnection || providerConnection.tenantId !== body.tenantId)) {
    throw createError({ statusCode: 400, statusMessage: 'Selected provider connection is invalid for this tenant' })
  }

  if (body.integrationMode === 'PROVIDER_QR' && !body.providerConnectionId) {
    throw createError({ statusCode: 400, statusMessage: 'Provider connection is required for Provider QR mode' })
  }
  if (body.integrationMode === 'PLATFORM_QR' && !['MAEMANEE', 'KSHOP', 'SLIP2GO', 'INTERNAL'].includes(body.providerCode.toUpperCase())) {
    throw createError({ statusCode: 400, statusMessage: 'Internal QR mode supports MAEMANEE/KSHOP/SLIP2GO/INTERNAL only' })
  }
  if (body.integrationMode === 'PROVIDER_QR' && !['PROMPTPAY', 'PAYIQ', 'KSHER', 'INTERNAL'].includes(body.providerCode.toUpperCase())) {
    throw createError({ statusCode: 400, statusMessage: 'Provider QR mode supports payment platform providers only' })
  }
  if (body.billerId) {
    const duplicated = await prisma.billerProfile.findFirst({
      where: {
        tenantId: body.tenantId,
        billerId: body.billerId
      },
      select: { id: true }
    })
    if (duplicated) {
      throw createError({ statusCode: 409, statusMessage: 'Biller ID already exists in this tenant' })
    }
  }

  const code = await generateBillerCode(body.tenantId, body.displayName)
  const config = buildConfig(body)
  const shouldCreateTenantDefault = body.merchantIds.length === 0 && body.branchIds.length === 0
  const merchantBindingIds = body.branchIds.length ? [] : body.merchantIds

  const created = await prisma.$transaction(async (tx) => {
    const txAny = tx as any
    const biller = await txAny.billerProfile.create({
      data: {
        tenantId: body.tenantId,
        code,
        displayName: body.displayName,
        providerCode: body.providerCode.toUpperCase(),
        integrationMode: body.integrationMode,
        status: body.status,
        priority: body.priority,
        billerId: body.billerId || null,
        providerConnectionId: body.providerConnectionId || null,
        shopId: body.providerCode.toUpperCase() === 'MAEMANEE' ? (body.maeManeeShopId || null) : null,
        accountName: body.accountName || null,
        bankName: body.bankName || null,
        accountNumber: body.accountNumber || null,
        promptPayTarget: body.promptPayTarget || null,
        slipVerifyConnectionId: body.slipVerifyConnectionId || null,
        config: config ? config : Prisma.JsonNull
      },
      select: {
        id: true
      }
    })

    if (shouldCreateTenantDefault) {
      await txAny.tenantBillerBinding.create({
        data: {
          tenantId: body.tenantId,
          billerProfileId: biller.id,
          isDefault: true,
          priority: body.priority,
          active: true
        }
      })
    }

    if (merchantBindingIds.length) {
      await txAny.merchantBillerBinding.createMany({
        data: merchantBindingIds.map((merchantAccountId) => ({
          tenantId: body.tenantId,
          merchantAccountId,
          billerProfileId: biller.id,
          priority: body.priority,
          active: true
        }))
      })
    }

    if (body.branchIds.length) {
      await txAny.branchBillerBinding.createMany({
        data: body.branchIds.map((branchId) => ({
          tenantId: body.tenantId,
          branchId,
          billerProfileId: biller.id,
          priority: body.priority,
          active: true
        }))
      })
    }

    return biller
  })

  return {
    success: true,
    id: created.id
  }
})
