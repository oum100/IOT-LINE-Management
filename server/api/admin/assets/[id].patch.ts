import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { assertMachineKindExists } from '../../../utils/machine-kind'

const schema = z.object({
  branchId: z.string().optional(),
  code: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(140).optional(),
  kind: z.string().trim().min(1).max(40).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
  metadata: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  const body = schema.parse(await readBody(event))
  const kind = body.kind ? await assertMachineKindExists(body.kind) : undefined
  const current = await prisma.asset.findUnique({
    where: { id },
    select: { branchId: true, name: true }
  })
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })

  if (body.code) {
    const normalizedCode = body.code.trim().toUpperCase()
    const duplicated = await prisma.asset.findFirst({
      where: {
        code: normalizedCode,
        id: { not: id }
      },
      select: { id: true }
    })
    if (duplicated) {
      throw createError({ statusCode: 409, statusMessage: 'Asset code already exists' })
    }
    body.code = normalizedCode
  }

  if (body.name !== undefined || body.branchId !== undefined) {
    const nextBranchId = body.branchId ?? current.branchId
    const nextName = body.name?.trim() || current.name
    const duplicatedName = await prisma.asset.findFirst({
      where: {
        branchId: nextBranchId,
        name: nextName,
        id: { not: id }
      },
      select: { id: true }
    })
    if (duplicatedName) {
      throw createError({ statusCode: 409, statusMessage: 'Asset name already exists in this branch' })
    }
    if (body.name !== undefined) body.name = nextName
  }

  return prisma.asset.update({
    where: { id },
    data: {
      ...body,
      ...(kind ? { kind } : {})
    }
  })
})
