import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing connection id' })

  const found = await (prisma as any).slipVerifyConnection.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      _count: {
        select: {
          billerProfiles: true
        }
      }
    }
  })

  if (!found) {
    throw createError({ statusCode: 404, statusMessage: 'Slip verify connection not found' })
  }

  requireDeleteConfirm(event, found.displayName)

  if (found._count.billerProfiles > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete a slip verify connection that is linked to billers' })
  }

  await (prisma as any).slipVerifyConnection.delete({
    where: { id }
  })

  return { success: true }
})
