import { prisma } from '#server/utils/prisma'
import { assertAdminAccess } from '#server/utils/admin-auth'

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
      code: true,
      name: true,
      tenantId: true,
      tenant: { select: { id: true, code: true, name: true } },
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
          merchantAccountId: true,
          merchantAccount: { select: { id: true, code: true, name: true } }
        }
      },
      bindings: {
        where: { status: 'ACTIVE' },
        select: {
          iotDevice: {
            select: {
              name: true,
              deviceUid: true,
              macAddress: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 1
      }
    }
  })
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }

  const rows = await prisma.assetProductPrice.findMany({
    where: {
      tenantId: asset.tenantId,
      assetId,
      active: true
    },
    select: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
          amount: true,
          quantity: true,
          serviceUnit: true,
          active: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: 200
  })

  const items = rows
    .map(item => item.product)
    .filter(Boolean)
    .map(product => ({
      id: product!.id,
      code: product!.code,
      name: product!.name,
      kind: product!.kind,
      amount: Number(product!.amount || 0),
      quantity: product!.quantity ?? null,
      serviceMode: product!.serviceMode || null,
      serviceUnit: product!.serviceUnit || null,
      active: Boolean(product!.active)
    }))

  return {
    items,
    scope: {
      tenant: asset.tenant
        ? { id: asset.tenant.id, code: asset.tenant.code, name: asset.tenant.name }
        : null,
      merchant: asset.branch?.merchantAccount
        ? {
            id: asset.branch.merchantAccount.id,
            code: asset.branch.merchantAccount.code,
            name: asset.branch.merchantAccount.name
          }
        : null,
      branch: asset.branch
        ? { id: asset.branch.id, code: asset.branch.code, name: asset.branch.name, merchantAccountId: asset.branch.merchantAccountId || null }
        : null
    },
    deviceName: asset.bindings[0]?.iotDevice?.name
      || asset.bindings[0]?.iotDevice?.deviceUid
      || asset.bindings[0]?.iotDevice?.macAddress
      || '-'
  }
})
