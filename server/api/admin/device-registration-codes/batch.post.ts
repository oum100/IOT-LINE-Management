import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { generateRegistrationCode } from '../../../utils/device-keys'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional(),
  note: z.string().trim().optional().nullable(),
  count: z.number().int().min(1).max(50).default(1)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  const items: Array<{ id: string; code: string; status: string; expiresAt: Date | null; createdAt: Date }> = []

  for (let i = 0; i < body.count; i += 1) {
    let created: { id: string; code: string; status: string; expiresAt: Date | null; createdAt: Date } | null = null
    for (let tries = 0; tries < 5; tries += 1) {
      const code = generateRegistrationCode()
      try {
        created = await prisma.deviceRegistrationCode.create({
          data: {
            tenantId: body.tenantId,
            merchantAccountId: body.merchantAccountId || null,
            branchId: body.branchId || null,
            code,
            note: body.note || null,
            expiresAt
          },
          select: {
            id: true,
            code: true,
            status: true,
            expiresAt: true,
            createdAt: true
          }
        })
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.includes('Unique constraint failed')) throw err
      }
    }
    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to generate unique registration code' })
    }
    items.push(created)
  }

  return {
    count: items.length,
    items,
    plainCodes: items.map(item => item.code)
  }
})

