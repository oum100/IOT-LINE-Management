import { z } from 'zod'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { hashPassword } from '../../../utils/password'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().optional(),
  tenantId: z.string().optional().nullable(),
  merchantAccountId: z.string().optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  const email = body.email.toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email } })
  const passwordHash = await hashPassword(body.password)

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: body.name || existing.name,
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          tenantId: body.tenantId || existing.tenantId,
          merchantAccountId: body.merchantAccountId || existing.merchantAccountId
        }
      })
    : await prisma.user.create({
        data: {
          email,
          name: body.name || null,
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          tenantId: body.tenantId || null,
          merchantAccountId: body.merchantAccountId || null
        }
      })

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  }
})
