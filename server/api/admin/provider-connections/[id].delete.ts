import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing provider connection id' })

  const found = await (prisma as any).providerConnection.findUnique({
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
    throw createError({ statusCode: 404, statusMessage: 'Provider connection not found' })
  }

  await requireDeleteConfirm(event, found.displayName)

  if (found._count.billerProfiles > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Provider connection cannot be deleted because it is already linked' })
  }

  await (prisma as any).providerConnection.delete({
    where: { id }
  })

  return { success: true }
})
