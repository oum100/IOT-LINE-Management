import { z } from 'zod'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  registrationCode: z.string().trim().min(6),
  machineSerialNo: z.string().trim().min(1).max(140),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const registration = await prisma.deviceRegistrationCode.findUnique({
    where: { code: body.registrationCode },
    include: { tenant: true }
  })
  if (!registration) throw createError({ statusCode: 404, statusMessage: 'Invalid registration code' })
  if (registration.status !== 'READY') throw createError({ statusCode: 409, statusMessage: 'Registration code is not ready' })
  if (registration.expiresAt && registration.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Registration code expired' })
  }

  const existing = await prisma.machine.findUnique({
    where: { serialNo: body.machineSerialNo },
    select: { id: true, serialNo: true, status: true, tenant: { select: { code: true } } }
  })
  if (existing) {
    return {
      ok: true,
      reused: true,
      tenantCode: existing.tenant?.code || registration.tenant.code,
      machine: { id: existing.id, serialNo: existing.serialNo, status: existing.status }
    }
  }

  const unit = await prisma.machine.create({
    data: {
      tenantId: registration.tenantId,
      code: `MU-${body.machineSerialNo.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || Date.now().toString().slice(-6)}`,
      name: body.machineSerialNo,
      serialNo: body.machineSerialNo,
      brand: body.brand || null,
      model: body.model || null,
      kind: 'WASHER',
      locationLabel: 'Unassigned',
      status: 'SPARE'
    }
  })

  await prisma.deviceRegistrationCode.update({
    where: { id: registration.id },
    data: { status: 'USED', usedAt: new Date() }
  })

  return {
    ok: true,
    tenantCode: registration.tenant.code,
    machine: { id: unit.id, serialNo: unit.serialNo, status: unit.status }
  }
})
