import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing tenant id' })

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, name: true }
  })
  if (!tenant) throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })

  await requireDeleteConfirm(event, tenant.name)

  const [merchantCount, branchCount, assetCount, orderCount, paymentCount] = await Promise.all([
    prisma.merchantAccount.count({ where: { tenantId: id } }),
    prisma.branch.count({ where: { tenantId: id } }),
    prisma.asset.count({ where: { tenantId: id } }),
    prisma.order.count({ where: { tenantId: id } }),
    prisma.payment.count({ where: { tenantId: id } })
  ])
  if (merchantCount || branchCount || assetCount || orderCount || paymentCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Tenant has linked data. Delete is blocked.'
    })
  }

  await prisma.tenant.delete({ where: { id } })
  return { ok: true }
})
