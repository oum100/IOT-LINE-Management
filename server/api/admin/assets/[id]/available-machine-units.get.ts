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

  let items: Array<{ id: string; serialNo: string | null; status?: string; brand?: string | null; model?: string | null }> = []
  try {
    items = await prisma.machine.findMany({
      where: {
        tenantId: asset.tenantId,
        status: 'SPARE',
        bindings: {
          none: {
            status: 'ACTIVE',
            endedAt: null
          }
        }
      },
      select: {
        id: true,
        serialNo: true,
        status: true,
        brand: true,
        model: true
      },
      orderBy: [{ createdAt: 'desc' }]
    })
  } catch {
    items = await prisma.machine.findMany({
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
        serialNo: true,
        brand: true,
        model: true
      },
      orderBy: [{ createdAt: 'desc' }]
    })
  }

  return { items }
})
