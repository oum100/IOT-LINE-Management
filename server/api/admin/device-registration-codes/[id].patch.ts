import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  status: z.enum(['READY', 'USED', 'EXPIRED', 'REVOKED']).optional(),
  note: z.string().trim().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing registration code id' })
  const body = schema.parse(await readBody(event))

  return prisma.deviceRegistrationCode.update({
    where: { id },
    data: {
      status: body.status,
      note: body.note === undefined ? undefined : body.note,
      expiresAt: body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(body.expiresAt) : null
    }
  })
})
