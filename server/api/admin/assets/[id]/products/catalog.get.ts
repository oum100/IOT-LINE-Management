import { prisma } from '../../../../../utils/prisma'
import { assertAdminAccess } from '../../../../../utils/admin-auth'

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
      tenantId: true,
      kind: true
    }
  })
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }

  const items = await prisma.product.findMany({
    where: {
      tenantId: asset.tenantId,
      kind: asset.kind,
      active: true
    },
    orderBy: [
      { name: 'asc' },
      { code: 'asc' }
    ]
  })

  return { items }
})

