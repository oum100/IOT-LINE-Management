import { prisma } from './prisma'

export type OrderRoutingContext = {
  tenantId?: string | null
  merchantAccountId?: string | null
  branchId?: string | null
}

export type ResolvedBillerProfile = {
  source: 'branch' | 'merchant' | 'tenant'
  tenantId: string | null
  merchantAccountId: string | null
  branchId: string | null
  billerProfileId: string
  providerCode: string | null
  integrationMode: 'PLATFORM_QR' | 'PROVIDER_QR'
  billerId: string | null
  shopId: string | null
  accountName: string | null
  bankName: string | null
  accountNumber: string | null
  promptPayTarget: string | null
  slipVerifyConnectionId: string | null
  slipVerifyProvider: string | null
  qrPaymentMode: 'promptpay' | 'maemanee' | 'maemanee_template' | null
  providerConnection: {
    id: string
    providerCode: string
    baseUrl: string | null
    appKey: string | null
    appSecret: string | null
    webhookSecret: string | null
    supportsQrIssue: boolean
    supportsCallback: boolean
    supportsSlipVerify: boolean
    credentials: unknown
  } | null
  slipVerifyConnection: {
    id: string
    code: string
    displayName: string
    providerCode: string
    baseUrl: string | null
    appKey: string | null
    appSecret: string | null
    webhookSecret: string | null
    credentials: unknown
  } | null
}

function readConfigString(config: unknown, key: string) {
  if (!config || typeof config !== 'object') return null
  const value = (config as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function readCredentialsObject(value: unknown) {
  return value && typeof value === 'object' ? value : null
}

function mapResolved(source: 'branch' | 'merchant' | 'tenant', binding: any): ResolvedBillerProfile | null {
  const biller = binding?.billerProfile
  if (!biller) return null

  return {
    source,
    tenantId: biller.tenantId || binding?.tenantId || null,
    merchantAccountId: binding?.merchantAccountId || binding?.branch?.merchantAccountId || null,
    branchId: binding?.branchId || null,
    billerProfileId: biller.id,
    providerCode: biller.providerCode || null,
    integrationMode: biller.integrationMode === 'PROVIDER_QR' ? 'PROVIDER_QR' : 'PLATFORM_QR',
    billerId: biller.billerId || null,
    shopId: biller.shopId || readConfigString(biller.config, 'maeManeeShopId'),
    accountName: biller.accountName || readConfigString(biller.config, 'accountName'),
    bankName: biller.bankName || readConfigString(biller.config, 'bankName'),
    accountNumber: biller.accountNumber || readConfigString(biller.config, 'accountNumber'),
    promptPayTarget: biller.promptPayTarget || readConfigString(biller.config, 'promptPayTarget'),
    slipVerifyConnectionId: biller.slipVerifyConnectionId || null,
    slipVerifyProvider: biller.slipVerifyConnection?.displayName || biller.slipVerifyConnection?.providerCode || readConfigString(biller.config, 'slipVerificationProvider'),
    qrPaymentMode: (readConfigString(biller.config, 'qrPaymentMode') as ResolvedBillerProfile['qrPaymentMode']) || null,
    providerConnection: biller.providerConnection ? {
      id: biller.providerConnection.id,
      providerCode: biller.providerConnection.providerCode,
      baseUrl: biller.providerConnection.baseUrl || null,
      appKey: biller.providerConnection.appKey || null,
      appSecret: biller.providerConnection.appSecret || null,
      webhookSecret: biller.providerConnection.webhookSecret || null,
      supportsQrIssue: Boolean(biller.providerConnection.supportsQrIssue),
      supportsCallback: Boolean(biller.providerConnection.supportsCallback),
      supportsSlipVerify: Boolean(biller.providerConnection.supportsSlipVerify),
      credentials: readCredentialsObject(biller.providerConnection.credentials)
    } : null,
    slipVerifyConnection: biller.slipVerifyConnection ? {
      id: biller.slipVerifyConnection.id,
      code: biller.slipVerifyConnection.code,
      displayName: biller.slipVerifyConnection.displayName,
      providerCode: biller.slipVerifyConnection.providerCode,
      baseUrl: biller.slipVerifyConnection.baseUrl || null,
      appKey: biller.slipVerifyConnection.appKey || null,
      appSecret: biller.slipVerifyConnection.appSecret || null,
      webhookSecret: biller.slipVerifyConnection.webhookSecret || null,
      credentials: readCredentialsObject(biller.slipVerifyConnection.credentials)
    } : null
  }
}

export async function resolveBillerProfileForOrder(context: OrderRoutingContext): Promise<ResolvedBillerProfile | null> {
  const tenantId = context.tenantId || null
  if (!tenantId) return null

  try {
    const orm = prisma as any
    const include = {
      branch: {
        select: {
          id: true,
          merchantAccountId: true
        }
      },
      billerProfile: {
        include: {
          providerConnection: true,
          slipVerifyConnection: true
        }
      }
    }

    if (context.branchId && orm.branchBillerBinding?.findFirst) {
      const branchBinding = await orm.branchBillerBinding.findFirst({
        where: {
          tenantId,
          branchId: context.branchId,
          active: true,
          billerProfile: {
            status: 'ACTIVE'
          }
        },
        orderBy: [
          { isDefault: 'desc' },
          { priority: 'asc' },
          { updatedAt: 'desc' }
        ],
        include
      })
      const resolved = mapResolved('branch', branchBinding)
      if (resolved) return resolved
    }

    if (context.merchantAccountId && orm.merchantBillerBinding?.findFirst) {
      const merchantBinding = await orm.merchantBillerBinding.findFirst({
        where: {
          tenantId,
          merchantAccountId: context.merchantAccountId,
          active: true,
          billerProfile: {
            status: 'ACTIVE'
          }
        },
        orderBy: [
          { isDefault: 'desc' },
          { priority: 'asc' },
          { updatedAt: 'desc' }
        ],
        include: {
          billerProfile: {
            include: {
              providerConnection: true,
              slipVerifyConnection: true
            }
          }
        }
      })
      const resolved = mapResolved('merchant', merchantBinding)
      if (resolved) return resolved
    }

    if (orm.tenantBillerBinding?.findFirst) {
      const tenantBinding = await orm.tenantBillerBinding.findFirst({
        where: {
          tenantId,
          active: true,
          billerProfile: {
            status: 'ACTIVE'
          }
        },
        orderBy: [
          { isDefault: 'desc' },
          { priority: 'asc' },
          { updatedAt: 'desc' }
        ],
        include: {
          billerProfile: {
            include: {
              providerConnection: true,
              slipVerifyConnection: true
            }
          }
        }
      })
      const resolved = mapResolved('tenant', tenantBinding)
      if (resolved) return resolved
    }
  } catch (error) {
    console.warn('[biller-routing] fallback to legacy config', error)
  }

  return null
}
