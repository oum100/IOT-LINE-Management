import { getServerSession } from '#auth'
import { prisma } from '../../utils/prisma'

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

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const where = isPlatformRole(user.role)
    ? {}
    : {
        ...(user.tenantId ? { tenantId: user.tenantId } : {}),
        ...(user.merchantAccountId ? { merchantAccountId: user.merchantAccountId } : {})
      }

  const [
    machineTotal,
    available,
    reserved,
    running,
    maintenance,
    orderTotal,
    orderPending,
    orderInProgress,
    orderCompleted
  ] = await Promise.all([
    prisma.machine.count({ where }),
    prisma.machine.count({ where: { ...where, status: 'AVAILABLE' } }),
    prisma.machine.count({ where: { ...where, status: 'RESERVED' } }),
    prisma.machine.count({ where: { ...where, status: 'RUNNING' } }),
    prisma.machine.count({ where: { ...where, status: 'MAINTENANCE' } }),
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, status: 'PENDING_PAYMENT' } }),
    prisma.order.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.order.count({ where: { ...where, status: 'COMPLETED' } })
  ])

  return {
    scope: isPlatformRole(user.role) ? 'platform' : 'tenant',
    machine: {
      total: machineTotal,
      available,
      reserved,
      running,
      maintenance
    },
    order: {
      total: orderTotal,
      pendingPayment: orderPending,
      inProgress: orderInProgress,
      completed: orderCompleted
    }
  }
})
