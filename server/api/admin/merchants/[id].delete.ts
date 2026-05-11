import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing merchant id' })

  const merchant = await prisma.merchantAccount.findUnique({
    where: { id },
    select: { id: true, name: true }
  })
  if (!merchant) throw createError({ statusCode: 404, statusMessage: 'Merchant not found' })

  await requireDeleteConfirm(event, merchant.name)

  const [branchCount, machineCount, orderCount, paymentCount] = await Promise.all([
    prisma.branch.count({ where: { merchantAccountId: id } }),
    prisma.machine.count({ where: { merchantAccountId: id } }),
    prisma.order.count({ where: { merchantAccountId: id } }),
    prisma.payment.count({ where: { merchantAccountId: id } })
  ])
  if (branchCount || machineCount || orderCount || paymentCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Merchant has linked data. Delete is blocked.'
    })
  }

  await prisma.merchantAccount.delete({ where: { id } })
  return { ok: true }
})
