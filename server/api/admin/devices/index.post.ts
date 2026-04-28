import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { macToDeviceUid, normalizeMacAddress } from '../../../utils/device-keys'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  macAddress: z.string().trim().min(5),
  fwVersion: z.string().trim().min(1),
  name: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  const tenant = await prisma.tenant.findUnique({
    where: { id: body.tenantId },
    select: { id: true }
  })
  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }
  const macAddress = normalizeMacAddress(body.macAddress)
  const deviceUid = macToDeviceUid(macAddress)

  try {
    const created = await prisma.iotDevice.create({
      data: {
        tenantId: body.tenantId,
        macAddress,
        deviceUid,
        name: body.name || `IOT-${deviceUid}`,
        model: body.model || null,
        fwVersion: body.fwVersion,
        status: 'SPARE',
        metadata: {
          source: 'admin-devices-create',
          merchantAccountId: body.merchantAccountId || null,
          branchId: body.branchId || null
        }
      }
    })

    return created
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    if (raw.includes('Unknown arg') && (raw.includes('name') || raw.includes('model'))) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Database schema is out of date for IotDevice.name/model. Please run Prisma migration and generate client.'
      })
    }
    throw error
  }
})
