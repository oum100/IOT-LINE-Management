import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, name: true }
  })
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })

  await requireDeleteConfirm(event, asset.name)

  const [orderItemCount, bindingCount, machineCount] = await Promise.all([
    prisma.orderItem.count({ where: { assetId: id } }),
    prisma.assetBinding.count({ where: { assetId: id } }),
    prisma.machine.count({ where: { assetId: id } })
  ])
  if (orderItemCount || bindingCount || machineCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Asset has linked data. Delete is blocked.'
    })
  }

  await prisma.asset.delete({ where: { id } })
  return { ok: true }
})
