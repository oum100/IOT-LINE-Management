import { z } from 'zod'
import { nanoid } from 'nanoid'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  tenantId: z.string().min(1),
  merchantAccountId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  metadata: z.record(z.any()).optional()
})

function buildCodePrefix(name: string) {
  const chunks = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (chunks.length > 1) {
    return chunks.slice(0, 3).map(chunk => chunk[0]).join('').slice(0, 3) || 'BRN'
  }
  return (chunks[0] || 'BRN').slice(0, 3)
}

async function generateBranchCode(tenantId: string, name: string) {
  const prefix = buildCodePrefix(name)
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `${prefix}_${nanoid(5).toUpperCase()}`
    const exists = await prisma.branch.findFirst({
      where: { tenantId, code },
      select: { id: true }
    })
    if (!exists) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'Failed to generate branch code' })
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const code = await generateBranchCode(body.tenantId, body.name)

  try {
    return await prisma.branch.create({
      data: {
        tenantId: body.tenantId,
        merchantAccountId: body.merchantAccountId || null,
        code,
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
