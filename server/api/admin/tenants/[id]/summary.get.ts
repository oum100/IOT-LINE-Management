import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

type SummaryResponse = {
  tenantId: string
  merchantCount: number
  branchCount: number
  assetCount: number
  deviceCount: number
  machineCount: number
  productCount: number
  paymentCount: number
  billerCount: number
  userCount: number
  orderCount: number
  totalOrderAmount: number
}

async function safeCount(task: () => Promise<number>) {
  try {
    return await task()
  } catch {
    return 0
  }
}

async function safeTotalAmount(tenantId: string) {
  try {
    const result = await prisma.order.aggregate({
      where: tenantId === 'all' ? {} : { tenantId },
      _sum: { totalAmount: true }
    })
    return Number(result._sum.totalAmount || 0)
  } catch {
    return 0
  }
}

export default defineEventHandler(async (event): Promise<SummaryResponse> => {
  await assertAdminAccess(event)

  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tenant id' })
  }

  const isAll = tenantId === 'all'

  const [
    merchantCount,
    branchCount,
    assetCount,
    deviceCount,
    machineCount,
    productCount,
    paymentCount,
    billerCount,
    userCount,
    orderCount,
    totalOrderAmount
  ] = await Promise.all([
    safeCount(() => prisma.merchantAccount.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.branch.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.asset.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.iotDevice.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.machine.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.product.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.payment.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.billerProfile.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.user.count({ where: isAll ? {} : { tenantId } })),
    safeCount(() => prisma.order.count({ where: isAll ? {} : { tenantId } })),
    safeTotalAmount(tenantId)
  ])

  return {
    tenantId,
    merchantCount,
    branchCount,
    assetCount,
    deviceCount,
    machineCount,
    productCount,
    paymentCount,
    billerCount,
    userCount,
    orderCount,
    totalOrderAmount
  }
})
