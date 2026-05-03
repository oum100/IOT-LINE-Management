import { prisma } from '../../../utils/prisma'
import { AppUserRole } from '@prisma/client'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing user id' })

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, tenantId: true, merchantAccountId: true, _count: { select: { scopeAssignments: true } } }
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  await requireDeleteConfirm(event, user.email)

  if (user.role === AppUserRole.ADMIN) {
    const adminCount = await prisma.user.count({
      where: {
        role: AppUserRole.ADMIN
      }
    })

    if (adminCount <= 1) {
      throw createError({
        statusCode: 409,
        statusMessage: 'The last platform admin cannot be deleted.'
      })
    }
  }

  if (user.tenantId || user.merchantAccountId || user._count.scopeAssignments > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'User is linked to tenant/merchant/scope assignment. Delete is blocked.'
    })
  }

  await prisma.account.deleteMany({ where: { userId: id } })
  await prisma.session.deleteMany({ where: { userId: id } })
  await prisma.user.delete({ where: { id } })
  return { ok: true }
})
