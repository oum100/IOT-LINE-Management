import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing machine id' })
  await prisma.machinePrice.deleteMany({ where: { machineId: id } })
  await prisma.machine.delete({ where: { id } })
  return { ok: true }
})
