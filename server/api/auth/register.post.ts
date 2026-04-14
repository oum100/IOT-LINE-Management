import { z } from 'zod'
import { hashPassword } from '../../utils/password'
import { prisma } from '../../utils/prisma'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(120).optional(),
  tenantCode: z.string().trim().min(1).optional(),
  merchantCode: z.string().trim().min(1).optional()
})

export default defineEventHandler(async (event) => {
  const body = registerSchema.parse(await readBody(event))
  const email = body.email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  })
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email is already registered'
    })
  }

  let tenantId: string | null = null
  let merchantAccountId: string | null = null

  if (body.tenantCode) {
    const tenant = await prisma.tenant.findUnique({
      where: { code: body.tenantCode },
      select: { id: true }
    })
    tenantId = tenant?.id || null
  }

  if (body.merchantCode && tenantId) {
    const merchant = await prisma.merchantAccount.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: body.merchantCode
        }
      },
      select: { id: true }
    })
    merchantAccountId = merchant?.id || null
  }

  const passwordHash = await hashPassword(body.password)
  const created = await prisma.user.create({
    data: {
      email,
      name: body.name?.trim() || null,
      passwordHash,
      role: 'USER',
      tenantId,
      merchantAccountId
    },
    select: {
      id: true,
      email: true,
      name: true
    }
  })

  return {
    ok: true,
    user: created
  }
})
