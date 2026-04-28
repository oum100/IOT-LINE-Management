import { createError, getQuery, getRouterParam } from 'h3'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, tenantId: true }
  })

  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  const orderStatus = typeof query.orderStatus === 'string' ? query.orderStatus.trim() : ''
  const paymentStatus = typeof query.paymentStatus === 'string' ? query.paymentStatus.trim() : ''
  const page = Math.max(1, Number(query.page || 1) || 1)
  const pageSize = Math.min(50, Math.max(5, Number(query.pageSize || 10) || 10))

  const where = {
    tenantId: asset.tenantId,
    ...(orderStatus ? { status: orderStatus as any } : {}),
    ...(paymentStatus ? { payment: { is: { status: paymentStatus as any } } } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
            { customerName: { contains: q, mode: 'insensitive' } },
            { id: { contains: q, mode: 'insensitive' } }
          ]
        }
      : {}),
    items: {
      some: {
        assetId: asset.id
      }
    }
  }

  const total = await prisma.order.count({ where })

  const items = await prisma.order.findMany({
    where,
    include: {
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          createdAt: true,
          updatedAt: true,
          verifiedAt: true
        }
      },
      _count: {
        select: {
          items: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize
  })

  return {
    asset: {
      id: asset.id,
      tenantId: asset.tenantId
    },
    total,
    page,
    pageSize,
    items
  }
})
