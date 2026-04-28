import { getServerSession } from '#auth'
import { prisma } from '../../../utils/prisma'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

function isPlatformRole(role: Role | string | null | undefined) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN'
}

function normalizeCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default defineEventHandler(async (event) => {
  const codeParam = getRouterParam(event, 'code')
  if (!codeParam) throw createError({ statusCode: 400, statusMessage: 'Missing machine kind code' })
  const code = normalizeCode(codeParam)

  const session = await getServerSession(event)
  const user = session?.user as {
    id?: string
    role?: Role
    tenantId?: string | null
  } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (!isPlatformRole(user.role) && !user.tenantId) {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }

  const found = await prisma.machineKind.findUnique({
    where: { code },
    select: {
      code: true,
      _count: {
        select: {
          assets: true,
          products: true,
          machines: true
        }
      }
    }
  })
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Machine kind not found' })

  const usedCount = found._count.assets + found._count.products + found._count.machines
  if (usedCount > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Cannot delete machine kind that is already in use' })
  }

  await prisma.machineKind.delete({ where: { code } })
  return { ok: true }
})

