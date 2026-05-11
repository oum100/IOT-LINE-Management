import { getQuery } from 'h3'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const { q, skip, take, page, pageSize } = withPaging(query)

  const andWhere: Prisma.UserWhereInput[] = []

  if (query.tenantId) {
    andWhere.push({ tenantId: String(query.tenantId) })
  }

  if (query.merchantAccountId) {
    const merchantAccountId = String(query.merchantAccountId)
    andWhere.push({
      OR: [
        { merchantAccountId },
        { scopeAssignments: { some: { active: true, merchantAccountId } } }
      ]
    })
  }

  if (query.branchId) {
    const branchId = String(query.branchId)
    andWhere.push({
      scopeAssignments: {
        some: {
          active: true,
          branchId
        }
      }
    })
  }

  if (q) {
    andWhere.push({
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } }
      ]
    })
  }

  const where: Prisma.UserWhereInput = andWhere.length ? { AND: andWhere } : {}

  const [items, total, adminCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        tenantId: true,
        merchantAccountId: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        scopeAssignments: {
          where: { active: true },
          select: {
            id: true,
            scopeType: true,
            merchantAccountId: true,
            branchId: true,
            merchantAccount: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            branch: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }
      }
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: 'ADMIN' } })
  ])

  return { items, total, page, pageSize, adminCount }
})
