import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../../../utils/admin-auth'
import { prisma } from '../../../../../utils/prisma'

const schema = z.object({
  name: z.string().trim().min(2),
  host: z.string().trim().min(2),
  port: z.coerce.number().int().min(1).max(65535),
  protocol: z.string().trim().min(2),
  username: z.string().trim().optional().nullable(),
  password: z.string().trim().optional().nullable(),
  tlsEnabled: z.coerce.boolean(),
  qosMode: z.coerce.number().int().min(0).max(2),
  mqttVersion: z.enum(['3.1', '3.1.1', '5.0']),
  connectTimeoutMs: z.coerce.number().int().min(1000).max(120000),
  keepAliveSec: z.coerce.number().int().min(10).max(3600),
  autoReconnect: z.coerce.boolean(),
  reconnectPeriodMs: z.coerce.number().int().min(500).max(120000),
  sslSecure: z.coerce.boolean().default(true),
  tlsAlpn: z.string().trim().optional().nullable(),
  tlsCaCert: z.string().trim().optional().nullable(),
  tlsClientCert: z.string().trim().optional().nullable(),
  tlsClientKey: z.string().trim().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED'])
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id is required' })
  const body = schema.parse(await readBody(event))

  const orm = prisma as any
  const found = await orm.mqttServer.findUnique({ where: { id }, select: { id: true } })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'MQTT server not found' })

  await orm.mqttServer.update({
    where: { id },
    data: {
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

  return { ok: true }
})
