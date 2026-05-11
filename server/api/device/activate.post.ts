import { getHeader } from 'h3'
import { z } from 'zod'
import { assertDeviceAuthByHeader, buildDeviceRuntimeConfig } from '#server/utils/device-runtime'
import { prisma } from '#server/utils/prisma'
import { refreshIotDeviceStatus } from '#server/utils/asset-lifecycle'

const schema = z.object({
  deviceUid: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const auth = await assertDeviceAuthByHeader(getHeader(event, 'x-device-key'))

  const device = await prisma.iotDevice.findUnique({
    where: { id: auth.iotDeviceId },
    select: { id: true, deviceUid: true, status: true }
  })
  if (!device) throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  if (body.deviceUid && device.deviceUid && body.deviceUid !== device.deviceUid) {
    throw createError({ statusCode: 403, statusMessage: 'Device UID mismatch' })
  }

  await prisma.$transaction(async (tx) => {
    await refreshIotDeviceStatus(tx, device.id)
  })

  const runtime = await buildDeviceRuntimeConfig(auth.iotDeviceId)
  if (!runtime.ready) {
    throw createError({ statusCode: 409, statusMessage: runtime.readiness })
  }

  const latest = await prisma.iotDevice.findUnique({
    where: { id: device.id },
    select: { status: true }
  })

  return {
    ok: true,
    activated: true,
    status: latest?.status || device.status,
    readiness: runtime.readiness,
    configVersion: runtime.configVersion
  }
})
