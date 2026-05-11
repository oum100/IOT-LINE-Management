import { createError } from 'h3'
import { prisma } from '#server/utils/prisma'
import { assertDeviceKey } from '#server/utils/device-keys'

export type DeviceAuthContext = {
  keyId: string
  iotDeviceId: string
}

export type RuntimeConfigResult = {
  ready: boolean
  readiness: 'READY' | 'MISSING_DEVICE' | 'MISSING_MACHINE' | 'MISSING_PRODUCT'
  reason?: 'READY' | 'MISSING_DEVICE' | 'MISSING_MACHINE' | 'MISSING_PRODUCT'
  configVersion: string
  scope: {
    tenant: { code: string; name: string } | null
    merchant: { code: string; name: string } | null
    branch: { code: string; name: string } | null
  }
  asset: { id: string; code: string; name: string } | null
  machine: { id: string; code: string; serialNo: string; kind: string } | null
  products: Array<{
    productId: string
    code: string
    name: string
    price: number
    priceUnit: string
    serviceQty: number
    serviceUnit: string
    serviceMode: string
    serviceLabel: string
    promotionPrice: number | null
  }>
  paymentPolicy: {
    allowSlipVerify: boolean
    allowCash: boolean
  }
}

export async function assertDeviceAuthByHeader(rawHeader: string | undefined | null): Promise<DeviceAuthContext> {
  const keyRecord = await assertDeviceKey(rawHeader)
  if (!keyRecord) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid device key' })
  }
  return {
    keyId: keyRecord.id,
    iotDeviceId: keyRecord.iotDeviceId
  }
}

export async function buildDeviceRuntimeConfig(iotDeviceId: string): Promise<RuntimeConfigResult> {
  const device = await prisma.iotDevice.findUnique({
    where: { id: iotDeviceId },
    include: { tenant: { select: { code: true, name: true } } }
  })
  if (!device) throw createError({ statusCode: 404, statusMessage: 'Device not found' })

  const binding = await prisma.assetBinding.findFirst({
    where: {
      iotDeviceId,
      status: 'ACTIVE',
      endedAt: null
    },
    include: {
      asset: {
        include: {
          branch: {
            include: {
              merchantAccount: true
            }
          }
        }
      },
      machine: true
    },
    orderBy: { updatedAt: 'desc' }
  })

  const scopeFromMetadata = (() => {
    const metadata = (device.metadata && typeof device.metadata === 'object')
      ? (device.metadata as Record<string, unknown>)
      : null
    return {
      merchantCode: metadata?.merchantCode ? String(metadata.merchantCode) : null,
      merchantName: metadata?.merchantName ? String(metadata.merchantName) : null,
      branchCode: metadata?.branchCode ? String(metadata.branchCode) : null,
      branchName: metadata?.branchName ? String(metadata.branchName) : null
    }
  })()

  if (!binding?.asset) {
    return {
      ready: false,
      readiness: 'MISSING_DEVICE',
      reason: 'MISSING_DEVICE',
      configVersion: device.updatedAt.toISOString(),
      scope: {
        tenant: device.tenant ? { code: device.tenant.code, name: device.tenant.name } : null,
        merchant: scopeFromMetadata.merchantCode && scopeFromMetadata.merchantName
          ? { code: scopeFromMetadata.merchantCode, name: scopeFromMetadata.merchantName }
          : null,
        branch: scopeFromMetadata.branchCode && scopeFromMetadata.branchName
          ? { code: scopeFromMetadata.branchCode, name: scopeFromMetadata.branchName }
          : null
      },
      asset: null,
      machine: null,
      products: [],
      paymentPolicy: {
        allowSlipVerify: true,
        allowCash: false
      }
    }
  }

  const now = new Date()
  const [prices, activeOffers] = await Promise.all([
    prisma.assetProductPrice.findMany({
      where: {
        assetId: binding.asset.id,
        active: true
      },
      include: {
        product: true
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    }),
    prisma.assetProductOffer.findMany({
      where: {
        assetId: binding.asset.id,
        active: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } }
        ]
      },
      orderBy: [
        { priority: 'asc' },
        { updatedAt: 'desc' }
      ]
    })
  ])

  const currentOfferByProductId = new Map<string, number>()
  for (const offer of activeOffers) {
    if (!currentOfferByProductId.has(offer.productId)) {
      currentOfferByProductId.set(offer.productId, offer.amount)
    }
  }

  const products = prices.map((item) => ({
    productId: item.productId,
    code: item.product.code,
    name: item.product.name,
    price: item.amount,
    priceUnit: 'THB',
    serviceQty: item.durationMinutes,
    serviceUnit: item.serviceUnit,
    serviceMode: item.serviceMode,
    serviceLabel: `${item.amount} THB / ${item.durationMinutes} Mins`,
    promotionPrice: currentOfferByProductId.get(item.productId) ?? null
  }))

  const versionTimes = [
    device.updatedAt,
    binding.updatedAt,
    binding.asset.updatedAt,
    binding.machine?.updatedAt || null,
    ...prices.map(p => p.updatedAt),
    ...activeOffers.map(o => o.updatedAt)
  ].filter(Boolean) as Date[]
  const latest = versionTimes.reduce((max, current) => current.getTime() > max.getTime() ? current : max, device.updatedAt)

  const hasActiveDeviceBinding = Boolean(binding?.iotDeviceId)
  const hasActiveMachineBinding = Boolean(binding?.machineId)
  const hasProductBinding = products.length > 0

  const readiness: RuntimeConfigResult['readiness'] = !hasActiveDeviceBinding
    ? 'MISSING_DEVICE'
    : !hasActiveMachineBinding
      ? 'MISSING_MACHINE'
      : !hasProductBinding
        ? 'MISSING_PRODUCT'
        : 'READY'

  return {
    ready: readiness === 'READY',
    readiness,
    reason: readiness,
    configVersion: latest.toISOString(),
    scope: {
      tenant: binding.asset.branch?.merchantAccount?.tenantId && device.tenant
        ? { code: device.tenant.code, name: device.tenant.name }
        : (device.tenant ? { code: device.tenant.code, name: device.tenant.name } : null),
      merchant: binding.asset.branch?.merchantAccount
        ? {
            code: binding.asset.branch.merchantAccount.code,
            name: binding.asset.branch.merchantAccount.name
          }
        : null,
      branch: binding.asset.branch
        ? {
            code: binding.asset.branch.code,
            name: binding.asset.branch.name
          }
        : null
    },
    asset: {
      id: binding.asset.id,
      code: binding.asset.code,
      name: binding.asset.name
    },
    machine: binding.machine
      ? {
          id: binding.machine.id,
          code: binding.machine.code,
          serialNo: binding.machine.serialNo,
          kind: binding.machine.kind
        }
      : null,
    products,
    paymentPolicy: {
      allowSlipVerify: true,
      allowCash: false
    }
  }
}
