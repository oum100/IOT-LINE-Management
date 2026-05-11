import { createError, getRouterParam } from 'h3'
import { assertAdminAccess } from '../../../../../utils/admin-auth'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id is required' })

  const orm = prisma as any
  const found = await orm.tenantMqttBinding.findUnique({ where: { id }, select: { id: true } })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Binding not found' })
  await orm.tenantMqttBinding.delete({ where: { id } })

  return { ok: true }
})
