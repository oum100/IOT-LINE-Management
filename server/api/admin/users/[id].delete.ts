import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing user id' })

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, tenantId: true, merchantAccountId: true }
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  await requireDeleteConfirm(event, user.email)
  if (user.tenantId || user.merchantAccountId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'User is linked to tenant/merchant. Delete is blocked.'
    })
  }

  await prisma.account.deleteMany({ where: { userId: id } })
  await prisma.session.deleteMany({ where: { userId: id } })
  await prisma.user.delete({ where: { id } })
  return { ok: true }
})
