import { getServerSession } from '#auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const sessionUser = session?.user as { id?: string } | undefined
  if (!sessionUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      isActive: true,
      role: true,
      tenantId: true
    }
  })

  if (!currentUser || !currentUser.isActive) {
    throw createError({ statusCode: 403, statusMessage: 'User is inactive or not found.' })
  }

  if (currentUser.tenantId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This account is already linked to a tenant.'
    })
  }

  return {
    message: 'Owner flow activated in portal scope.'
  }
})
