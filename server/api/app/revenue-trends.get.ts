import { getServerSession } from '#auth'
import { getQuery } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { assertPermission, isPlatformRole, resolvePortalScopeContext } from '../../utils/rbac'

const querySchema = z.object({
  mode: z.enum(['all', 'custom']).default('all'),
  merchantIds: z.string().optional(),
  branchIds: z.string().optional()
})

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

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
  await assertPermission(event, 'portal.revenue.read')
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
  const scope = await resolvePortalScopeContext(user)
  const tenantScopeId = isPlatformRole(user.role) ? null : (scope.resolvedTenantId || null)
  const lockedMerchantId = isPlatformRole(user.role) ? null : (scope.lockedMerchantId || null)

  const [merchants, branches] = await Promise.all([
    prisma.merchantAccount.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(scope.allowedMerchantIds !== null ? { id: { in: scope.allowedMerchantIds } } : {}),
        ...(lockedMerchantId ? { id: lockedMerchantId } : {})
      },
      select: { id: true }
    }),
    prisma.branch.findMany({
      where: {
        ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
        ...(scope.allowedMerchantIds !== null ? { merchantAccountId: { in: scope.allowedMerchantIds } } : {}),
        ...(scope.allowedBranchIds !== null ? { id: { in: scope.allowedBranchIds } } : {}),
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

  const expenseWhere = {
    occurredAt: { gte: monthlyStart, lte: now },
    ...(tenantScopeId ? { tenantId: tenantScopeId } : {}),
    ...(lockedMerchantId ? { merchantAccountId: lockedMerchantId } : {}),
    ...(query.mode === 'custom' && !lockedMerchantId && requestedMerchantIds.length
      ? { merchantAccountId: { in: requestedMerchantIds } }
      : {}),
    ...(query.mode === 'custom' && requestedBranchIds.length
      ? { branchId: { in: requestedBranchIds } }
      : {})
  }

  const expenseDelegate = (prisma as unknown as {
    expense?: {
      findMany: (args: {
        where: typeof expenseWhere
        select: { occurredAt: true; amount: true }
      }) => Promise<Array<{ occurredAt: Date; amount: number }>>
    }
  }).expense

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      select: {
        createdAt: true,
        totalAmount: true
      }
    }),
    expenseDelegate
      ? expenseDelegate.findMany({
          where: expenseWhere,
          select: {
            occurredAt: true,
            amount: true
          }
        })
      : Promise.resolve([])
  ])

  const dayMap = new Map<string, number>()
  const monthMap = new Map<string, number>()
  const expenseDayMap = new Map<string, number>()
  const expenseMonthMap = new Map<string, number>()

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

  for (const expense of expenses) {
    const occurredAt = new Date(expense.occurredAt)
    const day = startOfDay(occurredAt)
    const dayKey = day.toISOString().slice(0, 10)
    const mk = monthKey(occurredAt)
    const amount = Number(expense.amount || 0)

    if (day >= dailyStart) {
      expenseDayMap.set(dayKey, (expenseDayMap.get(dayKey) || 0) + amount)
    }
    expenseMonthMap.set(mk, (expenseMonthMap.get(mk) || 0) + amount)
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

  const dailyExpense = Array.from({ length: 60 }, (_, index) => {
    const day = new Date(dailyStart)
    day.setDate(dailyStart.getDate() + index)
    const key = day.toISOString().slice(0, 10)
    return {
      key,
      label: day.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
      amount: Number(expenseDayMap.get(key) || 0)
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

  const monthlyExpense = Array.from({ length: 24 }, (_, index) => {
    const d = new Date(monthlyStart)
    d.setMonth(monthlyStart.getMonth() + index)
    const key = monthKey(d)
    return {
      key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: Number(expenseMonthMap.get(key) || 0)
    }
  })

  return { daily, monthly, dailyExpense, monthlyExpense }
})
