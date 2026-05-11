import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing machine id' })

  const machine = await prisma.machine.findUnique({
    where: { id },
    select: { id: true, name: true, serialNo: true, code: true }
  })
  if (!machine) throw createError({ statusCode: 404, statusMessage: 'Machine not found' })

  await requireDeleteConfirm(event, machine.serialNo || machine.name || machine.code)

  const [orderItemCount, commandCount] = await Promise.all([
    prisma.orderItem.count({ where: { machineId: id } }),
    prisma.deviceCommand.count({ where: { machineId: id } })
  ])
  if (orderItemCount || commandCount) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Machine has linked data. Delete is blocked.'
    })
  }

  await prisma.machinePrice.deleteMany({ where: { machineId: id } })
  await prisma.machine.delete({ where: { id } })
  return { ok: true }
})
