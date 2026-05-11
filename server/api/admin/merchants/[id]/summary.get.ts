import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

type SummaryResponse = {
  merchantId: string
  tenantId: string
  branchCount: number
  assetCount: number
  deviceCount: number
  paymentCount: number
  billerCount: number
  userCount: number
  orderCount: number
}

async function safeCount(task: () => Promise<number>) {
  try {
    return await task()
  } catch {
    return 0
  }
}

export default defineEventHandler(async (event): Promise<SummaryResponse> => {
  await assertAdminAccess(event)

  const merchantId = getRouterParam(event, 'id')
  if (!merchantId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing merchant id' })
  }

  const merchant = await prisma.merchantAccount.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      tenantId: true
    }
  })

  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: 'Merchant not found' })
  }

  const [branchCount, assetCount, deviceCount, paymentCount, billerCount, userCount, orderCount] = await Promise.all([
    safeCount(() => prisma.branch.count({ where: { merchantAccountId: merchant.id } })),
    safeCount(() =>
      prisma.asset.count({
        where: {
          branch: {
            merchantAccountId: merchant.id
          }
        }
      })
    ),
    safeCount(() =>
      prisma.iotDevice.count({
        where: {
          bindings: {
            some: {
              asset: {
                branch: {
                  merchantAccountId: merchant.id
                }
              }
            }
          }
        }
      })
    ),
    safeCount(() => prisma.payment.count({ where: { merchantAccountId: merchant.id } })),
    safeCount(() => prisma.merchantBillerBinding.count({ where: { merchantAccountId: merchant.id } })),
    safeCount(() => prisma.user.count({ where: { merchantAccountId: merchant.id } })),
    safeCount(() => prisma.order.count({ where: { merchantAccountId: merchant.id } }))
  ])

  return {
    merchantId: merchant.id,
    tenantId: merchant.tenantId,
    branchCount,
    assetCount,
    deviceCount,
    paymentCount,
    billerCount,
    userCount,
    orderCount
  }
})
