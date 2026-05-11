import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing branch id' })

  const branch = await prisma.branch.findUnique({
    where: { id },
    select: { id: true, name: true }
  })
  if (!branch) throw createError({ statusCode: 404, statusMessage: 'Branch not found' })

  await requireDeleteConfirm(event, branch.name)

  const [assetCount, machineCount, orderCount, paymentCount] = await Promise.all([
    prisma.asset.count({ where: { branchId: id } }),
    prisma.machine.count({ where: { branchId: id } }),
    prisma.order.count({ where: { branchId: id } }),
    prisma.payment.count({ where: { branchId: id } })
  ])
  if (assetCount || machineCount || orderCount || paymentCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Branch has linked data. Delete is blocked.'
    })
  }

  await prisma.branch.delete({ where: { id } })
  return { ok: true }
})
