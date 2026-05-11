import { createError } from 'h3'
import { prisma } from './prisma'

export type ResolvedBranchContext = {
  id: string
  code: string
  name: string
  tenantId: string
  merchantAccountId: string | null
}

export async function resolveBranchByCode(branchCode: string): Promise<ResolvedBranchContext> {
  const code = String(branchCode || '').trim()
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Branch code is required' })
  }

  const rows = await prisma.branch.findMany({
    where: {
      OR: [
        { code },
        { name: { equals: code, mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      code: true,
      name: true,
      tenantId: true,
      merchantAccountId: true
    },
    take: 2
  })

  if (!rows.length) {
    throw createError({ statusCode: 404, statusMessage: 'Branch not found' })
  }
  if (rows.length > 1) {
    throw createError({ statusCode: 409, statusMessage: 'Branch code is ambiguous across tenants' })
  }

  const row = rows[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Branch not found' })

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    tenantId: row.tenantId,
    merchantAccountId: row.merchantAccountId || null
  }
}
