import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { resolveAssignmentStatus } from '../../../utils/asset-lifecycle'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing asset id' })
  const item = await prisma.asset.findUnique({
    where: { id },
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
      machines: true,
      bindings: {
        orderBy: { startedAt: 'desc' },
        include: {
          machineUnit: true,
          iotDevice: true
        }
      }
    }
  })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Asset not found' })

  const activeBindings = item.bindings.filter((binding) => binding.status === 'ACTIVE' && !binding.endedAt)
  const latestActiveBinding = activeBindings[0] || null
  const activeDeviceBinding = activeBindings.find((binding) => Boolean(binding.iotDeviceId)) || null
  const activeMachineBinding = activeBindings.find((binding) => Boolean(binding.machineUnitId)) || null
  const activeBinding = latestActiveBinding
    ? {
        ...latestActiveBinding,
        iotDevice: activeDeviceBinding?.iotDevice || latestActiveBinding.iotDevice,
        machineUnit: activeMachineBinding?.machineUnit || latestActiveBinding.machineUnit,
        startedAt: activeDeviceBinding?.startedAt || activeMachineBinding?.startedAt || latestActiveBinding.startedAt
      }
    : null
  const assignmentStatus = resolveAssignmentStatus({
    hasIotDevice: Boolean(activeBinding?.iotDevice),
    hasMachineUnit: Boolean(activeBinding?.machineUnit)
  })

  return {
    ...item,
    activeBinding,
    assignmentStatus,
    offersTimeline: {
      current: [],
      upcoming: [],
      history: []
    }
  }
})
