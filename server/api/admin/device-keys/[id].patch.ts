import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  label: z.string().trim().nullable().optional(),
  status: z.enum(['ACTIVE', 'REVOKED']).optional(),
  expiresAt: z.string().datetime().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing device key id' })
  const body = schema.parse(await readBody(event))

  return prisma.deviceApiKey.update({
    where: { id },
    data: {
      label: body.label === undefined ? undefined : body.label,
      status: body.status,
      revokedAt: body.status === 'REVOKED' ? new Date() : undefined,
      expiresAt: body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(body.expiresAt) : null
    }
  })
})
