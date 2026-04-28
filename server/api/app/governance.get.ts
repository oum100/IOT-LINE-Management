import { getServerSession } from '#auth'
import { prisma } from '../../utils/prisma'
import { resolvePaymentExpiryMinutes } from '../../utils/payment-expiry'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const resolvedTenantId = user.tenantId
    || (user.merchantAccountId
      ? (await prisma.merchantAccount.findUnique({
          where: { id: user.merchantAccountId },
          select: { tenantId: true }
        }))?.tenantId
      : null)

  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })

  const [users, billers, paymentExpiryMinutes] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: resolvedTenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        merchantAccountId: true
      }
    }),
    prisma.billerProfile.findMany({
      where: { tenantId: resolvedTenantId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 30,
      select: {
        id: true,
        code: true,
        displayName: true,
        providerCode: true,
        status: true,
        priority: true,
        billerId: true,
        _count: {
          select: {
            payments: true,
            merchantBindings: true,
            branchBindings: true
          }
        }
      }
    }),
    resolvePaymentExpiryMinutes(event)
  ])

  const billersWithDelete = billers.map((item) => {
    const linkedCount = item._count.payments + item._count.merchantBindings + item._count.branchBindings
    return {
      id: item.id,
      code: item.code,
      displayName: item.displayName,
      providerCode: item.providerCode,
      status: item.status,
      priority: item.priority,
      billerId: item.billerId,
      merchantBindingCount: item._count.merchantBindings,
      branchBindingCount: item._count.branchBindings,
      linkedCount,
      canDelete: linkedCount === 0
    }
  })

  return {
    users,
    billers: billersWithDelete,
    paymentExpiryMinutes
  }
})
