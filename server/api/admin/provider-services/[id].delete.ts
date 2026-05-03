import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const bodySchema = z.object({
  confirmText: z.string().trim().optional().default('')
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing provider service id' })

  const body = bodySchema.parse(await readBody(event).catch(() => ({})))
  if (body.confirmText !== 'DELETE') {
    throw createError({ statusCode: 400, statusMessage: 'Delete confirmation is required (confirmText=DELETE).' })
  }

  const orm = prisma as any
  const found = await orm.providerService.findUnique({
    where: { id },
    select: { id: true, _count: { select: { providerConnections: true } } }
  })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Provider service not found' })
  if ((found._count?.providerConnections || 0) > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Cannot delete provider service that is already linked to provider connections' })
  }

  await orm.providerService.delete({ where: { id } })
  return { success: true }
})

