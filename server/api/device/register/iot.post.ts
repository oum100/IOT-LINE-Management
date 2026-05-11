import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { macToDeviceUid, normalizeMacAddress } from '../../../utils/device-keys'

const schema = z.object({
  registrationCode: z.string().trim().min(6),
  macAddress: z.string().trim().min(5),
  fwVersion: z.string().trim().min(1),
  name: z.string().trim().optional(),
  model: z.string().trim().optional(),
  spare: z.boolean().optional().default(false)
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const registration = await prisma.deviceRegistrationCode.findUnique({
    where: { code: body.registrationCode },
    include: { tenant: true, merchantAccount: true, branch: true }
  })
  if (!registration) throw createError({ statusCode: 404, statusMessage: 'Invalid registration code' })
  if (registration.status !== 'READY') throw createError({ statusCode: 409, statusMessage: 'Registration code is not ready' })
  if (registration.expiresAt && registration.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Registration code expired' })
  }
  const scope = {
    tenant: { code: registration.tenant.code, name: registration.tenant.name },
    merchant: registration.merchantAccount ? { code: registration.merchantAccount.code, name: registration.merchantAccount.name } : null,
    branch: registration.branch ? { code: registration.branch.code, name: registration.branch.name } : null
  }

  const macAddress = normalizeMacAddress(body.macAddress)
  const deviceUid = macToDeviceUid(macAddress)
  const existing = await prisma.iotDevice.findUnique({
    where: { macAddress },
    select: { id: true, macAddress: true, deviceUid: true, status: true, metadata: true, tenant: { select: { code: true } } }
  })
  if (existing) {
    const metadata = (existing.metadata || {}) as Record<string, unknown>
    return {
      ok: true,
      reused: true,
      scope,
      merchantCode: String(metadata.merchantCode || registration.merchantAccount?.code || '') || null,
      branchCode: String(metadata.branchCode || registration.branch?.code || '') || null,
      device: {
        id: existing.id,
        macAddress: existing.macAddress,
        deviceUid: existing.deviceUid,
        status: existing.status
      }
    }
  }

  const device = await prisma.iotDevice.create({
    data: {
      tenantId: registration.tenantId,
      macAddress,
      deviceUid,
      name: body.name || `IOT-${deviceUid}`,
      model: body.model || null,
      fwVersion: body.fwVersion,
      status: body.spare ? 'SPARE' : 'NEW',
      metadata: {
        source: body.spare ? 'register-iot-spare' : 'register-iot-new',
        merchantAccountId: registration.merchantAccountId || null,
        branchId: registration.branchId || null,
        merchantCode: registration.merchantAccount?.code || null,
        merchantName: registration.merchantAccount?.name || null,
        branchCode: registration.branch?.code || null,
        branchName: registration.branch?.name || null
      }
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
    scope,
    merchantCode: registration.merchantAccount?.code || null,
    branchCode: registration.branch?.code || null,
    device: {
      id: device.id,
      macAddress: device.macAddress,
      deviceUid: device.deviceUid,
      status: device.status
    }
  }
})
