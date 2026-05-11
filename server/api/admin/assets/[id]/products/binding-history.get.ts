import { prisma } from '#server/utils/prisma'
import { assertAdminAccess } from '#server/utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const assetId = getRouterParam(event, 'id')
  if (!assetId) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, tenantId: true }
  })
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })

  const rows = await prisma.assetProductPrice.findMany({
    where: {
      tenantId: asset.tenantId,
      assetId: asset.id
    },
    select: {
      id: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: 200
  })

  const items = rows.map((row) => {
    const eventType = row.active
      ? (row.createdAt.getTime() === row.updatedAt.getTime() ? 'BOUND' : 'REBOUND')
      : 'UNBOUND'
    return {
      id: row.id,
      eventType,
      active: row.active,
      eventAt: row.updatedAt,
      product: row.product
    }
  })

  return { items }
})
