import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { generateDeviceApiKey, macToDeviceUid, normalizeMacAddress } from '../../utils/device-keys'
import { assertMachineKindExists } from '../../utils/machine-kind'
import {
  lockAssetBindingRowsForUpdate,
  lockAssetForUpdate,
  lockDeviceForUpdate,
  lockMachineUnitForUpdate,
  refreshIotDeviceStatus,
  refreshMachineUnitStatus
} from '../../utils/asset-lifecycle'

const schema = z.object({
  registrationCode: z.string().trim().min(6),
  macAddress: z.string().trim().min(5),
  fwVersion: z.string().trim().optional(),
  machineSerialNo: z.string().trim().min(3),
  machineName: z.string().trim().min(1),
  machineKind: z.string().trim().min(1).max(40),
  machineCode: z.string().trim().optional(),
  locationLabel: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const machineKind = await assertMachineKindExists(body.machineKind)

  const registration = await prisma.deviceRegistrationCode.findUnique({
    where: { code: body.registrationCode },
    include: {
      branch: true,
      merchantAccount: true,
      tenant: true
    }
  })
  if (!registration) {
    throw createError({ statusCode: 404, statusMessage: 'Invalid registration code' })
  }
  if (registration.status !== 'READY') {
    throw createError({ statusCode: 409, statusMessage: 'Registration code is not ready' })
  }
  if (registration.expiresAt && registration.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Registration code expired' })
  }
  if (!registration.branchId) {
    throw createError({ statusCode: 400, statusMessage: 'Registration code missing branch assignment' })
  }

  const machineCode = body.machineCode || `AUTO-${machineKind}-${body.machineSerialNo.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`
  const macAddress = normalizeMacAddress(body.macAddress)
  const deviceUid = macToDeviceUid(macAddress)

  const iotDevice = await prisma.iotDevice.upsert({
    where: { macAddress },
    create: {
      tenantId: registration.tenantId,
      macAddress,
      deviceUid,
      name: body.machineName,
      model: machineKind,
      fwVersion: body.fwVersion || null,
      metadata: {
        source: 'device-register-api'
      }
    },
    update: {
      deviceUid,
      name: body.machineName,
      model: machineKind,
      fwVersion: body.fwVersion || undefined
    }
  })

  const machineUnit = await prisma.machineUnit.upsert({
    where: { serialNo: body.machineSerialNo },
    create: {
      tenantId: registration.tenantId,
      serialNo: body.machineSerialNo
    },
    update: {}
  })

  const asset = await prisma.asset.upsert({
    where: { assetUuid: deviceUid },
    create: {
      tenantId: registration.tenantId,
      branchId: registration.branchId,
      assetUuid: deviceUid,
      code: machineCode,
      name: body.machineName,
      kind: machineKind,
      status: 'ACTIVE'
    },
    update: {
      branchId: registration.branchId,
      code: machineCode,
      name: body.machineName,
      kind: machineKind
    }
  })

  await prisma.$transaction(async (tx) => {
    await lockAssetForUpdate(tx, asset.id)
    await lockDeviceForUpdate(tx, iotDevice.id)
    await lockMachineUnitForUpdate(tx, machineUnit.id)
    await lockAssetBindingRowsForUpdate(tx, asset.id, iotDevice.id, machineUnit.id)

    const [activeBinding, activeByDevice, activeByMachine] = await Promise.all([
      tx.assetBinding.findFirst({
        where: {
          tenantId: registration.tenantId,
          assetId: asset.id,
          status: 'ACTIVE',
          endedAt: null
        },
        orderBy: { startedAt: 'desc' }
      }),
      tx.assetBinding.findFirst({
        where: {
          tenantId: registration.tenantId,
          iotDeviceId: iotDevice.id,
          status: 'ACTIVE',
          endedAt: null,
          NOT: { assetId: asset.id }
        }
      }),
      tx.assetBinding.findFirst({
        where: {
          tenantId: registration.tenantId,
          machineUnitId: machineUnit.id,
          status: 'ACTIVE',
          endedAt: null,
          NOT: { assetId: asset.id }
        }
      })
    ])

    if (activeByDevice || activeByMachine) {
      throw createError({ statusCode: 409, statusMessage: 'Device or machine unit is already bound to another asset' })
    }

    if (!activeBinding || activeBinding.iotDeviceId !== iotDevice.id || activeBinding.machineUnitId !== machineUnit.id) {
      const oldIotDeviceId = activeBinding?.iotDeviceId || null
      const oldMachineUnitId = activeBinding?.machineUnitId || null
      if (activeBinding) {
        await tx.assetBinding.update({
          where: { id: activeBinding.id },
          data: {
            status: 'INACTIVE',
            endedAt: new Date(),
            reason: 're-registered'
          }
        })
      }
      await tx.assetBinding.create({
        data: {
          tenantId: registration.tenantId,
          assetId: asset.id,
          iotDeviceId: iotDevice.id,
          machineUnitId: machineUnit.id,
          reason: 'registered'
        }
      })

      if (oldIotDeviceId) {
        await refreshIotDeviceStatus(tx, oldIotDeviceId)
      }
      if (oldMachineUnitId) {
        await refreshMachineUnitStatus(tx, oldMachineUnitId)
      }
    }

    await refreshIotDeviceStatus(tx, iotDevice.id)
    await refreshMachineUnitStatus(tx, machineUnit.id)
  })

  const machine = await prisma.machine.upsert({
    where: { code: machineCode },
    create: {
      tenantId: registration.tenantId,
      merchantAccountId: registration.merchantAccountId || null,
      branchId: registration.branchId,
      assetId: asset.id,
      code: machineCode,
      name: body.machineName,
      kind: machineKind,
      status: 'AVAILABLE',
      locationLabel: body.locationLabel || registration.branch?.name || 'Default',
      topic: `iot/${deviceUid}`
    },
    update: {
      tenantId: registration.tenantId,
      merchantAccountId: registration.merchantAccountId || null,
      branchId: registration.branchId,
      assetId: asset.id,
      name: body.machineName,
      kind: machineKind,
      locationLabel: body.locationLabel || registration.branch?.name || 'Default',
      topic: `iot/${deviceUid}`
    }
  })

  await prisma.deviceRegistrationCode.update({
    where: { id: registration.id },
    data: {
      status: 'USED',
      usedAt: new Date(),
      usedByIotDeviceId: iotDevice.id
    }
  })

  const generatedKey = generateDeviceApiKey()
  await prisma.deviceApiKey.create({
    data: {
      iotDeviceId: iotDevice.id,
      keyPrefix: generatedKey.keyPrefix,
      secretHash: generatedKey.secretHash,
      label: 'Auto-generated at register'
    }
  })

  return {
    ok: true,
    tenantCode: registration.tenant.code,
    merchantCode: registration.merchantAccount?.code || null,
    branchCode: registration.branch?.code || null,
    machine: {
      id: machine.id,
      code: machine.code,
      name: machine.name
    },
    device: {
      id: iotDevice.id,
      macAddress: iotDevice.macAddress,
      deviceUid: iotDevice.deviceUid
    },
    deviceApiKey: generatedKey.key
  }
})
