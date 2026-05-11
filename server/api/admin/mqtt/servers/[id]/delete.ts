import { createError, getRouterParam } from 'h3'
import { assertAdminAccess } from '../../../../../utils/admin-auth'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id is required' })

  const orm = prisma as any
  const found = await orm.mqttServer.findUnique({
    where: { id },
    select: { id: true, _count: { select: { tenantBindings: true } } }
  })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'MQTT server not found' })
  if ((found._count?.tenantBindings || 0) > 0) {
    throw createError({ statusCode: 409, statusMessage: 'This MQTT server is linked to tenants and cannot be deleted' })
  }

  await orm.mqttServer.delete({ where: { id } })
  return { ok: true }
})
