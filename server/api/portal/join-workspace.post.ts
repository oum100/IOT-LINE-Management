import { getServerSession } from '#auth'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'

const schema = z.object({
  code: z.string().trim().min(2).max(120)
})

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const sessionUser = session?.user as { id?: string } | undefined
  if (!sessionUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = schema.parse(await readBody(event))
  const code = body.code.trim()

  const currentUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      isActive: true,
      tenantId: true,
      merchantAccountId: true
    }
  })

  if (!currentUser || !currentUser.isActive) {
    throw createError({ statusCode: 403, statusMessage: 'User is inactive or not found.' })
  }

  const tenant = await prisma.tenant.findFirst({
    where: {
      code: { equals: code, mode: 'insensitive' },
      status: 'ACTIVE'
    },
    select: { id: true, code: true, name: true }
  })

  if (tenant) {
    if (currentUser.tenantId && currentUser.tenantId !== tenant.id) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This account is already linked to another tenant.'
      })
    }

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        tenantId: tenant.id,
        merchantAccountId: null
      }
    })

    return {
      type: 'tenant',
      tenantId: tenant.id,
      message: `Joined tenant ${tenant.name}.`
    }
  }

  const merchants = await prisma.merchantAccount.findMany({
    where: {
      code: { equals: code, mode: 'insensitive' },
      status: 'ACTIVE',
      tenant: { status: 'ACTIVE' }
    },
    select: {
      id: true,
      name: true,
      tenantId: true,
      tenant: { select: { id: true, name: true } }
    },
    take: 2
  })

  if (!merchants.length) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant or Merchant code not found.' })
  }

  if (merchants.length > 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Merchant code is ambiguous. Please use Tenant Code instead.'
    })
  }

  const merchant = merchants[0]!
  if (currentUser.tenantId && currentUser.tenantId !== merchant.tenantId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This account is already linked to another tenant.'
    })
  }

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      tenantId: merchant.tenantId,
      merchantAccountId: merchant.id
    }
  })

  return {
    type: 'merchant',
    tenantId: merchant.tenantId,
    merchantAccountId: merchant.id,
    message: `Joined merchant ${merchant.name}.`
  }
})
