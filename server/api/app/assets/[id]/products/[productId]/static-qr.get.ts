import { getServerSession } from '#auth'
import { getRouterParam } from 'h3'
import { prisma } from '../../../../../../utils/prisma'
import { assertPermission, resolvePortalScopeContext } from '../../../../../../utils/rbac'
import { resolveBillerProfileForOrder } from '../../../../../../utils/biller-routing'
import { resolveMaeManeeReferencePrefix, resolveQrPaymentMode } from '../../../../../../utils/system-config'
import { buildPromptPayPayload } from '../../../../../../utils/payment'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

function pricingTypeRank(type: string) {
  if (type === 'PROMOTION') return 0
  if (type === 'SPECIAL') return 1
  return 2
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const assetId = getRouterParam(event, 'id')
  const productId = getRouterParam(event, 'productId')
  if (!assetId || !productId) throw createError({ statusCode: 400, statusMessage: 'Missing asset id or product id' })

  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: Role } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const scope = await resolvePortalScopeContext(user)
  const resolvedTenantId = scope.resolvedTenantId
  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      tenantId: resolvedTenantId,
      ...(scope.allowedBranchIds !== null ? { branchId: { in: scope.allowedBranchIds } } : {}),
      ...(scope.allowedMerchantIds !== null ? { branch: { merchantAccountId: { in: scope.allowedMerchantIds } } } : {})
    },
    select: {
      id: true,
      code: true,
      name: true,
      branchId: true,
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
          merchantAccountId: true,
          merchantAccount: { select: { id: true, code: true, name: true } }
        }
      }
    }
  })
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found in scope' })

  const price = await prisma.assetProductPrice.findFirst({
    where: {
      tenantId: resolvedTenantId,
      assetId: asset.id,
      productId,
      active: true
    },
    select: {
      id: true,
      amount: true,
      product: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  })
  if (!price?.product) throw createError({ statusCode: 404, statusMessage: 'Product binding not found for selected asset' })

  const now = new Date()
  const activeOffers = await prisma.assetProductOffer.findMany({
    where: {
      tenantId: resolvedTenantId,
      assetId: asset.id,
      productId,
      active: true,
      AND: [
        { effectiveFrom: { lte: now } },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }
      ]
    },
    select: {
      id: true,
      pricingType: true,
      amount: true,
      priority: true,
      effectiveFrom: true,
      effectiveTo: true
    },
    orderBy: [{ priority: 'asc' }, { effectiveFrom: 'desc' }]
  })

  let currentOffer: (typeof activeOffers)[number] | null = null
  for (const item of activeOffers) {
    if (!currentOffer) {
      currentOffer = item
      continue
    }
    const priorityDiff = item.priority - currentOffer.priority
    if (priorityDiff < 0 || (priorityDiff === 0 && pricingTypeRank(item.pricingType) < pricingTypeRank(currentOffer.pricingType))) {
      currentOffer = item
    }
  }

  const amount = Number(currentOffer?.amount ?? price.amount)
  const biller = await resolveBillerProfileForOrder({
    tenantId: resolvedTenantId,
    merchantAccountId: asset.branch?.merchantAccountId || null,
    branchId: asset.branchId
  })

  const defaultQrPaymentMode = await resolveQrPaymentMode(event)
  const maeManeeReferencePrefix = await resolveMaeManeeReferencePrefix(event)
  const runtimeConfig = useRuntimeConfig(event)
  const qrPaymentMode = biller?.qrPaymentMode || defaultQrPaymentMode
  const qrReference = `${asset.branch?.code || 'BR'}-${asset.code}-${price.product.code}`.replace(/[^A-Z0-9-]/gi, '').toUpperCase().slice(0, 24)

  const qrText = buildPromptPayPayload({
    mode: qrPaymentMode || 'promptpay',
    target: biller?.promptPayTarget || runtimeConfig.promptPayTarget,
    amount,
    orderNumber: qrReference,
    billerId: biller?.billerId || runtimeConfig.maeManeeBillerId,
    referencePrefix: maeManeeReferencePrefix
  })

  if (!qrText) {
    throw createError({ statusCode: 400, statusMessage: 'Failed to build QR payload' })
  }

  return {
    mode: qrPaymentMode || 'promptpay',
    qrText,
    amount,
    asset: {
      id: asset.id,
      code: asset.code,
      name: asset.name
    },
    branch: {
      id: asset.branch?.id || null,
      code: asset.branch?.code || null,
      name: asset.branch?.name || null
    },
    merchant: {
      id: asset.branch?.merchantAccount?.id || null,
      code: asset.branch?.merchantAccount?.code || null,
      name: asset.branch?.merchantAccount?.name || null
    },
    product: {
      id: price.product.id,
      code: price.product.code,
      name: price.product.name,
      baseAmount: Number(price.amount)
    },
    currentOffer: currentOffer
      ? {
          id: currentOffer.id,
          pricingType: currentOffer.pricingType,
          amount: Number(currentOffer.amount),
          priority: currentOffer.priority,
          effectiveFrom: currentOffer.effectiveFrom,
          effectiveTo: currentOffer.effectiveTo
        }
      : null,
    biller: biller
      ? {
          source: biller.source,
          providerCode: biller.providerCode,
          integrationMode: biller.integrationMode,
          qrPaymentMode: biller.qrPaymentMode,
          billerId: biller.billerId,
          shopId: biller.shopId,
          accountName: biller.accountName,
          bankName: biller.bankName,
          accountNumber: biller.accountNumber,
          promptPayTarget: biller.promptPayTarget
        }
      : null,
    qrFields: {
      reference: qrReference,
      tenantId: resolvedTenantId,
      branchCode: asset.branch?.code || null,
      assetCode: asset.code,
      productCode: price.product.code
    }
  }
})
