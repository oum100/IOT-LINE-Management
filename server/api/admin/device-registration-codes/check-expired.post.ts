import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  const where = {
    tenantId: body.tenantId,
    status: 'READY' as const,
    expiresAt: { lt: new Date() },
    ...(body.merchantAccountId ? { merchantAccountId: body.merchantAccountId } : {}),
    ...(body.branchId ? { branchId: body.branchId } : {})
  }

  const result = await prisma.deviceRegistrationCode.updateMany({
    where,
    data: { status: 'EXPIRED' }
  })

  return { ok: true, updated: result.count }
})
