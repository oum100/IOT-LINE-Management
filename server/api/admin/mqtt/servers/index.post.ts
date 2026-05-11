import { createError, readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

const schema = z.object({
  code: z.string().trim().min(2),
  name: z.string().trim().min(2),
  host: z.string().trim().min(2),
  port: z.coerce.number().int().min(1).max(65535).default(1883),
  protocol: z.string().trim().min(2).default('mqtt'),
  username: z.string().trim().optional().nullable(),
  password: z.string().trim().optional().nullable(),
  tlsEnabled: z.coerce.boolean().default(false),
  qosMode: z.coerce.number().int().min(0).max(2).default(0),
  mqttVersion: z.enum(['3.1', '3.1.1', '5.0']).default('3.1.1'),
  connectTimeoutMs: z.coerce.number().int().min(1000).max(120000).default(10000),
  keepAliveSec: z.coerce.number().int().min(10).max(3600).default(60),
  autoReconnect: z.coerce.boolean().default(true),
  reconnectPeriodMs: z.coerce.number().int().min(500).max(120000).default(3000),
  sslSecure: z.coerce.boolean().default(true),
  tlsAlpn: z.string().trim().optional().nullable(),
  tlsCaCert: z.string().trim().optional().nullable(),
  tlsClientCert: z.string().trim().optional().nullable(),
  tlsClientKey: z.string().trim().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']).default('ACTIVE')
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const orm = prisma as any

  const exists = await orm.mqttServer.findFirst({
    where: { OR: [{ code: body.code }, { name: body.name }] },
    select: { id: true }
  })
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: 'MQTT server code or name already exists' })
  }

  const created = await orm.mqttServer.create({
    data: {
      code: body.code.toUpperCase(),
      name: body.name,
      host: body.host,
      port: body.port,
      protocol: body.protocol,
      username: body.username || null,
      password: body.password || null,
      tlsEnabled: body.tlsEnabled,
      qosMode: body.qosMode,
      mqttVersion: body.mqttVersion,
      connectTimeoutMs: body.connectTimeoutMs,
      keepAliveSec: body.keepAliveSec,
      autoReconnect: body.autoReconnect,
      reconnectPeriodMs: body.reconnectPeriodMs,
      metadata: {
        tls: {
          sslSecure: body.sslSecure,
          alpn: body.tlsAlpn || null,
          caCert: body.tlsCaCert || null,
          clientCert: body.tlsClientCert || null,
          clientKey: body.tlsClientKey || null
        }
      },
      status: body.status
    }
  })

  return { id: created.id }
})
