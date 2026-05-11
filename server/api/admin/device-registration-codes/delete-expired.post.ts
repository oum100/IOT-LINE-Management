import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { requireDeleteConfirm } from '../../../utils/delete-guard'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  await requireDeleteConfirm(event)
  const body = schema.parse(await readBody(event))

  const where = {
    tenantId: body.tenantId,
    status: 'EXPIRED' as const,
    ...(body.merchantAccountId ? { merchantAccountId: body.merchantAccountId } : {}),
    ...(body.branchId ? { branchId: body.branchId } : {})
  }

  const result = await prisma.deviceRegistrationCode.deleteMany({ where })
  return { ok: true, deleted: result.count }
})
