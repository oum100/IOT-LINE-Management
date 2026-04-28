import { z } from 'zod'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  registrationCode: z.string().trim().min(6),
  machineSerialNo: z.string().trim().min(3),
  brand: z.string().trim().optional(),
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

  const unit = await prisma.machineUnit.upsert({
    where: { serialNo: body.machineSerialNo },
    create: {
      tenantId: registration.tenantId,
      serialNo: body.machineSerialNo,
      brand: body.brand || null,
      model: body.model || null,
      status: 'SPARE'
    },
    update: {
      brand: body.brand || undefined,
      model: body.model || undefined,
      status: 'SPARE'
    }
  })

  await prisma.deviceRegistrationCode.update({
    where: { id: registration.id },
    data: {
      status: 'USED',
      usedAt: new Date()
    }
  })

  return {
    ok: true,
    tenantCode: registration.tenant.code,
    machineUnit: {
      id: unit.id,
      serialNo: unit.serialNo,
      status: unit.status
    }
  }
})
