import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      tenantId: true
    }
  })
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }

  let items: Array<{ id: string; macAddress: string; deviceUid: string | null }> = []
  try {
    items = await prisma.iotDevice.findMany({
      where: {
        tenantId: asset.tenantId,
        status: { in: ['NEW', 'SPARE'] },
        bindings: {
          none: {
            status: 'ACTIVE',
            endedAt: null
          }
        }
      },
      select: {
        id: true,
        macAddress: true,
        deviceUid: true
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    })
  } catch {
    items = await prisma.iotDevice.findMany({
      where: {
        tenantId: asset.tenantId,
        bindings: {
          none: {
            status: 'ACTIVE',
            endedAt: null
          }
        }
      },
      select: {
        id: true,
        macAddress: true,
        deviceUid: true
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    })
  }

  return { items }
})
