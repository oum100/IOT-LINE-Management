import net from 'node:net'
import tls from 'node:tls'
import { createError, readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '#server/utils/admin-auth'

const schema = z.object({
  host: z.string().trim().min(2),
  port: z.coerce.number().int().min(1).max(65535).default(1883),
  protocol: z.string().trim().min(2).default('mqtt'),
  tlsEnabled: z.coerce.boolean().default(false),
  connectTimeoutMs: z.coerce.number().int().min(1000).max(120000).default(10000)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  const useTls = body.tlsEnabled || body.protocol === 'mqtts' || body.protocol === 'wss'
  const started = Date.now()

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => reject(err)

      const socket = useTls
        ? tls.connect({
            host: body.host,
            port: body.port,
            rejectUnauthorized: false,
            servername: body.host
          })
        : net.connect({
            host: body.host,
            port: body.port
          })

      socket.setTimeout(body.connectTimeoutMs)
      socket.once('timeout', () => {
        socket.destroy()
        reject(new Error(`Connection timeout (${body.connectTimeoutMs}ms)`))
      })
      socket.once('error', onError)
      socket.once('connect', () => {
        socket.end()
        resolve()
      })
    })
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Unable to connect to MQTT server'
    })
  }

  const latency = Date.now() - started
  const mode = useTls ? 'TLS socket' : 'TCP socket'
  return {
    ok: true,
    detail: `Connection OK (${mode}) in ${latency}ms`
  }
})
