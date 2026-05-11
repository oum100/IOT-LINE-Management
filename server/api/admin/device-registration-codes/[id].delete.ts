import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing registration code id' })
  await requireDeleteConfirm(event)
  const current = await prisma.deviceRegistrationCode.findUnique({
    where: { id },
    select: { status: true }
  })
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Registration code not found' })
  if (current.status !== 'READY' && current.status !== 'EXPIRED') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only READY or EXPIRED registration code can be deleted.'
    })
  }
  await prisma.deviceRegistrationCode.delete({ where: { id } })
  return { ok: true }
})
