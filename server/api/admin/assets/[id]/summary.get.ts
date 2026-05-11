import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

type SummaryResponse = {
  totalCount: number
  activeCount: number
  inactiveCount: number
  maintenanceCount: number
  deviceCount: number
  paymentCount: number
  orderCount: number
}

export default defineEventHandler(async (event): Promise<SummaryResponse> => {
  await assertAdminAccess(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      branchId: true
    }
  })

  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }

  const [deviceCount, paymentCount, orderCount] = await Promise.all([
    prisma.iotDevice.count({
      where: {
        bindings: {
          some: {
            assetId: asset.id
          }
        }
      }
    }),
    prisma.payment.count({
      where: {
        order: {
          items: {
            some: {
              OR: [
                { assetId: asset.id },
                { machine: { assetId: asset.id } }
              ]
            }
          }
        }
      }
    }),
    prisma.order.count({
      where: {
        items: {
          some: {
            OR: [
              { assetId: asset.id },
              { machine: { assetId: asset.id } }
            ]
          }
        }
      }
    })
  ])

  return {
    totalCount: 1,
    activeCount: asset.status === 'ACTIVE' ? 1 : 0,
    inactiveCount: asset.status === 'INACTIVE' ? 1 : 0,
    maintenanceCount: asset.status === 'MAINTENANCE' ? 1 : 0,
    deviceCount,
    paymentCount,
    orderCount
  }
})
