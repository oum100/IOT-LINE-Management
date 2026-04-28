import { getServerSession } from '#auth'
import { getQuery } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

const querySchema = z.object({
  mode: z.enum(['all', 'custom']).default('all'),
  merchantIds: z.string().optional(),
  branchIds: z.string().optional()
})

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

function parseIds(raw?: string) {
  if (!raw) return [] as string[]
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function monthKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
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

  const query = querySchema.parse(getQuery(event))
  const tenantScopeId = isPlatformRole(user.role) ? null : (user.tenantId || null)
  const lockedMerchantId = isPlatformRole(user.role) ? null : (user.merchantAccountId || null)

  const [merchants, branches] = await Promise.all([
    prisma.merchantAccount.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(lockedMerchantId ? { id: lockedMerchantId } : {})
      },
      select: { id: true }
    }),
    prisma.branch.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {})
      },
      select: { id: true, merchantAccountId: true }
    })
  ])

  const availableMerchantIds = new Set(merchants.map(item => item.id))
  const availableBranchIds = new Set(branches.map(item => item.id))

  const requestedMerchantIds = parseIds(query.merchantIds).filter(id => availableMerchantIds.has(id))
  const requestedBranchIds = parseIds(query.branchIds).filter(id => availableBranchIds.has(id))

  const now = new Date()
  const dailyStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59))
  const monthlyStart = new Date(now.getFullYear(), now.getMonth() - 23, 1)
  monthlyStart.setHours(0, 0, 0, 0)

  const orderWhere = {
    createdAt: { gte: monthlyStart, lte: now },
    ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
    ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
    ...(query.mode === 'custom' && !lockedMerchantId && requestedMerchantIds.length
      ? { merchantAccountId: { in: requestedMerchantIds } }
      : {}),
    ...(query.mode === 'custom' && requestedBranchIds.length
      ? { branchId: { in: requestedBranchIds } }
      : {})
  }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      createdAt: true,
      totalAmount: true
    }
  })

  const dayMap = new Map<string, number>()
  const monthMap = new Map<string, number>()

  for (const order of orders) {
    const createdAt = new Date(order.createdAt)
    const day = startOfDay(createdAt)
    const dayKey = day.toISOString().slice(0, 10)
    const mk = monthKey(createdAt)
    const amount = Number(order.totalAmount || 0)

    if (day >= dailyStart) {
      dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + amount)
    }
    monthMap.set(mk, (monthMap.get(mk) || 0) + amount)
  }

  const daily = Array.from({ length: 60 }, (_, index) => {
    const day = new Date(dailyStart)
    day.setDate(dailyStart.getDate() + index)
    const key = day.toISOString().slice(0, 10)
    return {
      key,
      label: day.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
      amount: Number(dayMap.get(key) || 0)
    }
  })

  const monthly = Array.from({ length: 24 }, (_, index) => {
    const d = new Date(monthlyStart)
    d.setMonth(monthlyStart.getMonth() + index)
    const key = monthKey(d)
    return {
      key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: Number(monthMap.get(key) || 0)
    }
  })

  return { daily, monthly }
})

