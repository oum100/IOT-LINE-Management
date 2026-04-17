import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

type SummaryResponse = {
  branchId: string
  tenantId: string
  merchantAccountId: string | null
  assetCount: number
  deviceCount: number
  machineCount: number
  paymentCount: number
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

  const branchId = getRouterParam(event, 'id')
  if (!branchId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch id' })
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      tenantId: true,
      merchantAccountId: true
    }
  })

  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: 'Branch not found' })
  }

  const [assetCount, deviceCount, machineCount, paymentCount, orderCount] = await Promise.all([
    safeCount(() => prisma.asset.count({ where: { branchId: branch.id } })),
    safeCount(() =>
      prisma.iotDevice.count({
        where: {
          bindings: {
            some: {
              asset: {
                branchId: branch.id
              }
            }
          }
        }
      })
    ),
    safeCount(() => prisma.machine.count({ where: { branchId: branch.id } })),
    safeCount(() => prisma.payment.count({ where: { branchId: branch.id } })),
    safeCount(() => prisma.order.count({ where: { branchId: branch.id } }))
  ])

  return {
    branchId: branch.id,
    tenantId: branch.tenantId,
    merchantAccountId: branch.merchantAccountId,
    assetCount,
    deviceCount,
    machineCount,
    paymentCount,
    orderCount
  }
})
