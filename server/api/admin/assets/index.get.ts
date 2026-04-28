import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'
import { resolveAssignmentStatus } from '../../../utils/asset-lifecycle'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '').trim()
  const merchantAccountId = String(query.merchantAccountId || '').trim()
  const branchId = String(query.branchId || '').trim()

  const { q, skip, take, page, pageSize } = withPaging(query)
  const where = {
    ...(tenantId ? { tenantId } : {}),
    ...(merchantAccountId
      ? {
          branch: {
            merchantAccountId
          }
        }
      : {}),
    ...(branchId ? { branchId } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
            { assetUuid: { contains: q, mode: 'insensitive' as const } },
            { id: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        branch: true,
        bindings: {
          where: {
            status: 'ACTIVE',
            endedAt: null
          },
          select: {
            iotDeviceId: true,
            machineUnitId: true
          },
          orderBy: { startedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.asset.count({ where })
  ])

  const mappedItems = items.map((item) => {
    const active = item.bindings[0]
    return {
      ...item,
      assignmentStatus: resolveAssignmentStatus({
        hasIotDevice: Boolean(active?.iotDeviceId),
        hasMachineUnit: Boolean(active?.machineUnitId)
      })
    }
  })

  return { items: mappedItems, total, page, pageSize }
})
