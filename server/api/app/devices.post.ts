import { getServerSession } from '#auth'
import { readBody } from 'h3'
import { z } from 'zod'
import { macToDeviceUid, normalizeMacAddress } from '../../utils/device-keys'
import { prisma } from '../../utils/prisma'
import { assertPermission } from '../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'ADMIN' || normalized === 'USER'
}

const bodySchema = z.object({
  macAddress: z.string().trim().min(5),
  fwVersion: z.string().trim().min(1),
  name: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
    merchantAccountId?: string | null
  } | undefined

  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = bodySchema.parse(await readBody(event))
  const resolvedTenantId = user.tenantId
    || (user.merchantAccountId
      ? (await prisma.merchantAccount.findUnique({
          where: { id: user.merchantAccountId },
          select: { tenantId: true }
        }))?.tenantId
      : null)

  if (!isPlatformRole(user.role) && !resolvedTenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }
  if (!resolvedTenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant not found in scope' })
  }

  const macAddress = normalizeMacAddress(body.macAddress)
  const deviceUid = macToDeviceUid(macAddress)

  const created = await prisma.iotDevice.create({
    data: {
      tenantId: resolvedTenantId,
      macAddress,
      deviceUid,
      fwVersion: body.fwVersion,
      name: body.name || null,
      model: body.model || null,
      status: 'SPARE'
    },
    select: {
      id: true,
      deviceUid: true,
      macAddress: true,
      status: true,
      fwVersion: true,
      name: true,
      model: true
    }
  })

  return created
})
