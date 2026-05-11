import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing biller id' })

  const biller = await prisma.billerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      _count: {
        select: {
          payments: true,
          tenantBindings: true,
          merchantBindings: true,
          branchBindings: true
        }
      }
    }
  })

  if (!biller) {
    throw createError({ statusCode: 404, statusMessage: 'Biller not found' })
  }

  await requireDeleteConfirm(event, biller.displayName)

  if (biller._count.payments > 0 || biller._count.tenantBindings > 0 || biller._count.merchantBindings > 0 || biller._count.branchBindings > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Biller cannot be deleted because it is already linked' })
  }

  await prisma.billerProfile.delete({
    where: { id }
  })

  return { success: true }
})
