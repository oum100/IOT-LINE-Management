import { getServerSession } from '#auth'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'

const schema = z.object({
  code: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(120)
})

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const sessionUser = session?.user as { id?: string } | undefined
  if (!sessionUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = schema.parse(await readBody(event))
  const code = body.code.trim()
  const name = body.name.trim()

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      isActive: true,
      tenantId: true
    }
  })

  if (!user || !user.isActive) {
    throw createError({ statusCode: 403, statusMessage: 'User is inactive or not found.' })
  }

  if (user.tenantId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This account is already linked to a tenant.'
    })
  }

  const exists = await prisma.tenant.findFirst({
    where: {
      code: { equals: code, mode: 'insensitive' }
    },
    select: { id: true }
  })
  if (exists) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Tenant Code already exists.'
    })
  }

  const created = await prisma.tenant.create({
    data: {
      code,
      name,
      status: 'ACTIVE'
    },
    select: {
      id: true,
      code: true,
      name: true
    }
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: 'OWNER',
      tenantId: created.id,
      merchantAccountId: null
    }
  })

  return {
    tenant: created,
    message: `Tenant created: ${created.code}`
  }
})
