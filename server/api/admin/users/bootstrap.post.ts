import { z } from 'zod'
import { getHeader, getRequestIP } from 'h3'
import { getServerSession } from '#auth'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { addPlatformBootstrapAuditLog } from '../../../utils/platform-bootstrap-audit'
import { hashPassword } from '../../../utils/password'
import { markPlatformInitialized } from '../../../utils/platform-state'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const adminCount = await prisma.user.count({
    where: {
      role: 'ADMIN'
    }
  })
  const isFirstPlatformAdmin = adminCount === 0

  if (!isFirstPlatformAdmin) {
    await assertAdminAccess(event)
  }

  const email = body.email.toLowerCase().trim()
  const session = await getServerSession(event).catch(() => null)
  const actorUserId = (session?.user as { id?: string } | undefined)?.id || null
  const existing = await prisma.user.findUnique({ where: { email } })
  const passwordHash = await hashPassword(body.password)
  const bootstrapMode = isFirstPlatformAdmin ? 'first-time' : 'admin-managed'

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: body.name || existing.name,
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          tenantId: null,
          merchantAccountId: null
        }
      })
    : await prisma.user.create({
        data: {
          email,
          name: body.name || null,
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          tenantId: null,
          merchantAccountId: null
        }
      })

  await addPlatformBootstrapAuditLog({
    action: existing ? 'BOOTSTRAP_ADMIN_PROMOTED' : 'BOOTSTRAP_ADMIN_CREATED',
    bootstrapMode,
    userId: user.id,
    email: user.email,
    actorUserId,
    ipAddress: getRequestIP(event, { xForwardedFor: true }) || null,
    userAgent: getHeader(event, 'user-agent') || null,
    metadata: {
      previousRole: existing?.role || null,
      wasExistingUser: !!existing,
      createdByAdmin: !isFirstPlatformAdmin
    }
  })

  if (isFirstPlatformAdmin) {
    await markPlatformInitialized()
  }

  return {
    ok: true,
    bootstrapMode,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  }
})
