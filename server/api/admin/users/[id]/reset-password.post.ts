import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'
import { hashPassword } from '../../../../utils/password'

const schema = z.object({
  password: z.string().min(8).default('P@ssw0rd')
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing user id' })

  const body = schema.parse((await readBody(event)) || {})
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true }
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const passwordHash = await hashPassword(body.password)
  await prisma.user.update({
    where: { id },
    data: { passwordHash }
  })

  return { ok: true }
})
