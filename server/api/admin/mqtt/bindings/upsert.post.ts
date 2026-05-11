import { createError, readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

const schema = z.object({
  tenantId: z.string().trim().min(1),
  mqttServerId: z.string().trim().min(1),
  topicPrefix: z.string().trim().min(1),
  active: z.boolean().default(true)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const orm = prisma as any

  const [tenant, server] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: body.tenantId }, select: { id: true } }),
    orm.mqttServer.findUnique({ where: { id: body.mqttServerId }, select: { id: true } })
  ])
  if (!tenant) throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  if (!server) throw createError({ statusCode: 404, statusMessage: 'MQTT server not found' })

  const existing = await orm.tenantMqttBinding.findUnique({
    where: { tenantId: body.tenantId },
    select: { id: true }
  })

  if (existing) {
    await orm.tenantMqttBinding.update({
      where: { tenantId: body.tenantId },
      data: {
        mqttServerId: body.mqttServerId,
        topicPrefix: body.topicPrefix,
        active: body.active
      }
    })
  } else {
    await orm.tenantMqttBinding.create({
      data: {
        tenantId: body.tenantId,
        mqttServerId: body.mqttServerId,
        topicPrefix: body.topicPrefix,
        active: body.active
      }
    })
  }

  return { ok: true }
})
