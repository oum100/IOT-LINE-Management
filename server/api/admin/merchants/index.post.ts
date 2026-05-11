import { z } from 'zod'
import { nanoid } from 'nanoid'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'

const schema = z.object({
  tenantId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  environment: z.enum(['TEST', 'LIVE']).optional(),
  metadata: z.record(z.any()).optional()
})

function buildCodePrefix(name: string) {
  const chunks = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (chunks.length > 1) {
    return chunks.slice(0, 3).map(chunk => chunk[0]).join('').slice(0, 3) || 'MCH'
  }
  return (chunks[0] || 'MCH').slice(0, 3)
}

async function generateMerchantCode(tenantId: string, name: string) {
  const prefix = buildCodePrefix(name)
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `${prefix}_${nanoid(5).toUpperCase()}`
    const exists = await prisma.merchantAccount.findFirst({
      where: { tenantId, code },
      select: { id: true }
    })
    if (!exists) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'Failed to generate merchant code' })
}

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))
  const code = await generateMerchantCode(body.tenantId, body.name)

  return prisma.merchantAccount.create({
    data: {
      tenantId: body.tenantId,
      code,
      name: body.name,
      status: body.status || 'ACTIVE',
      environment: body.environment || 'TEST',
      metadata: body.metadata
    }
  })
})
