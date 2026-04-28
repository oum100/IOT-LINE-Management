import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { macToDeviceUid, normalizeMacAddress } from '../../../utils/device-keys'

const schema = z.object({
  registrationCode: z.string().trim().min(6),
  macAddress: z.string().trim().min(5),
  fwVersion: z.string().trim().min(1),
  name: z.string().trim().optional(),
  model: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const registration = await prisma.deviceRegistrationCode.findUnique({
    where: { code: body.registrationCode },
    include: {
      tenant: true
    }
  })
  if (!registration) throw createError({ statusCode: 404, statusMessage: 'Invalid registration code' })
  if (registration.status !== 'READY') throw createError({ statusCode: 409, statusMessage: 'Registration code is not ready' })
  if (registration.expiresAt && registration.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Registration code expired' })
  }

  const macAddress = normalizeMacAddress(body.macAddress)
  const deviceUid = macToDeviceUid(macAddress)

  const device = await prisma.iotDevice.upsert({
    where: { macAddress },
    create: {
      tenantId: registration.tenantId,
      macAddress,
      deviceUid,
      name: body.name || `IOT-${deviceUid}`,
      model: body.model || null,
      fwVersion: body.fwVersion,
      status: 'SPARE',
      metadata: {
        source: 'spare-iot-register-api'
      }
    },
    update: {
      deviceUid,
      name: body.name || undefined,
      model: body.model || undefined,
      fwVersion: body.fwVersion,
      status: 'SPARE'
    }
  })

  await prisma.deviceRegistrationCode.update({
    where: { id: registration.id },
    data: {
      status: 'USED',
      usedAt: new Date(),
      usedByIotDeviceId: device.id
    }
  })

  return {
    ok: true,
    tenantCode: registration.tenant.code,
    device: {
      id: device.id,
      macAddress: device.macAddress,
      deviceUid: device.deviceUid
    }
  }
})
