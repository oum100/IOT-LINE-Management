import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { generateRegistrationCode } from '../../../utils/device-keys'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional(),
  note: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  const code = generateRegistrationCode()
  const created = await prisma.deviceRegistrationCode.create({
    data: {
      tenantId: body.tenantId,
      merchantAccountId: body.merchantAccountId || null,
      branchId: body.branchId || null,
      code,
      note: body.note || null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
    }
  })

  return {
    ...created,
    plainCode: code
  }
})
