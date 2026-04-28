import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  try {
    return await prisma.branch.create({
      data: {
        tenantId: body.tenantId,
        merchantAccountId: body.merchantAccountId || null,
        code: body.code,
        name: body.name,
        status: body.status || 'ACTIVE',
        metadata: body.metadata
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('Unique constraint failed')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Branch code already exists in this tenant.'
      })
    }
    throw error
  }
})
