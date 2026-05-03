import { getServerSession } from '#auth'
import { prisma } from '../../../utils/prisma'
import { assertPermission } from '../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.settings.manage')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing biller id' })

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

  const found = await prisma.billerProfile.findFirst({
    where: { id, tenantId: resolvedTenantId },
    select: { id: true }
  })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Biller not found' })

  const [paymentCount, merchantBindingCount, branchBindingCount] = await Promise.all([
    prisma.payment.count({ where: { billerProfileId: id } }),
    prisma.merchantBillerBinding.count({ where: { billerProfileId: id } }),
    prisma.branchBillerBinding.count({ where: { billerProfileId: id } })
  ])

  if (paymentCount || merchantBindingCount || branchBindingCount) {
    throw createError({ statusCode: 409, statusMessage: 'Biller has linked data. Delete is blocked.' })
  }

  await prisma.billerProfile.delete({ where: { id } })
  return { ok: true }
})
