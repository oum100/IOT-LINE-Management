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
  const assetType = String(query.assetType || '').trim().toUpperCase()

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
    ...(assetType ? { kind: assetType } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
            { id: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        branch: {
          include: {
            merchantAccount: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        },
        prices: {
          where: { active: true },
          select: {
            product: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          take: 20
        },
        bindings: {
          where: {
            status: 'ACTIVE',
            endedAt: null
          },
          select: {
            iotDeviceId: true,
            machineId: true,
            iotDevice: {
              select: {
                id: true,
                deviceUid: true,
                macAddress: true,
                name: true
              }
            },
            machine: {
              select: {
                id: true,
                name: true,
                serialNo: true,
                model: true
              }
            }
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
        hasMachine: Boolean(active?.machineId)
      }),
      iot: active?.iotDevice
        ? {
            id: active.iotDevice.id,
            name: active.iotDevice.name || null,
            deviceUid: active.iotDevice.deviceUid || null,
            macAddress: active.iotDevice.macAddress || null
          }
        : null,
      machine: active?.machine
        ? {
            id: active.machine.id,
            name: active.machine.name || active.machine.serialNo,
            serialNo: active.machine.serialNo,
            model: active.machine.model || null
          }
        : null,
      products: item.prices
        .map(row => row.product)
        .filter(Boolean)
        .map((product: { id: string; name: string; code: string } | null) => ({
          id: product?.id || '',
          name: product?.name || '',
          code: product?.code || ''
        }))
    }
  })

  return { items: mappedItems, total, page, pageSize }
})
