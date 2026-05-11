import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { generateDeviceApiKey, macToDeviceUid, normalizeMacAddress } from '../../../utils/device-keys'
import { assertMachineKindExists } from '../../../utils/machine-kind'
import { refreshIotDeviceStatus, refreshMachineStatus } from '../../../utils/asset-lifecycle'

const schema = z.object({
  registrationCode: z.string().trim().min(6),
  macAddress: z.string().trim().min(5),
  fwVersion: z.string().trim().optional(),
  iotName: z.string().trim().optional(),
  iotModel: z.string().trim().optional(),
  machineSerialNo: z.string().trim().min(1).max(140),
  machineBrand: z.string().trim().optional(),
  machineModel: z.string().trim().optional(),
  machineKind: z.string().trim().min(1).max(40),
  assetName: z.string().trim().min(1),
  locationLabel: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const machineKind = await assertMachineKindExists(body.machineKind)
  const registration = await prisma.deviceRegistrationCode.findUnique({
    where: { code: body.registrationCode },
    include: { branch: true, merchantAccount: true, tenant: true }
  })
  if (!registration) throw createError({ statusCode: 404, statusMessage: 'Invalid registration code' })
  if (registration.status !== 'READY') throw createError({ statusCode: 409, statusMessage: 'Registration code is not ready' })
  if (registration.expiresAt && registration.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Registration code expired' })
  }
  if (!registration.branchId) throw createError({ statusCode: 400, statusMessage: 'Registration code missing branch assignment' })

  const macAddress = normalizeMacAddress(body.macAddress)
  const deviceUid = macToDeviceUid(macAddress)
  const machineCode = `MC-${machineKind}-${body.machineSerialNo.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`
  const assetCode = `AS-${deviceUid.slice(-8)}`

  const [existingDevice, existingMachine, existingAsset] = await Promise.all([
    prisma.iotDevice.findUnique({ where: { macAddress }, select: { id: true } }),
    prisma.machine.findUnique({ where: { serialNo: body.machineSerialNo }, select: { id: true } }),
    prisma.asset.findUnique({ where: { assetUuid: deviceUid }, select: { id: true } })
  ])
  if (existingDevice) throw createError({ statusCode: 409, statusMessage: 'IOT device already registered for this MAC address' })
  if (existingMachine) throw createError({ statusCode: 409, statusMessage: 'Machine already registered for this serial number' })
  if (existingAsset) throw createError({ statusCode: 409, statusMessage: 'Asset already registered for this device UID' })

  const result = await prisma.$transaction(async (tx) => {
    const iotDevice = await tx.iotDevice.create({
      data: {
        tenantId: registration.tenantId,
        macAddress,
        deviceUid,
        name: body.iotName || `IOT-${deviceUid}`,
        model: body.iotModel || machineKind,
        fwVersion: body.fwVersion || null,
        status: 'NEW',
        metadata: { source: 'register-asset' }
      }
    })

    const machine = await tx.machine.create({
      data: {
        tenantId: registration.tenantId,
        merchantAccountId: registration.merchantAccountId || null,
        branchId: registration.branchId,
        serialNo: body.machineSerialNo,
        code: machineCode,
        name: body.machineSerialNo,
        brand: body.machineBrand || null,
        model: body.machineModel || null,
        kind: machineKind,
        locationLabel: body.locationLabel || registration.branch?.name || 'Default',
        status: 'NEW',
        topic: `iot/${deviceUid}`
      }
    })

    const asset = await tx.asset.create({
      data: {
        tenantId: registration.tenantId,
        branchId: registration.branchId,
        assetUuid: deviceUid,
        code: assetCode,
        name: body.assetName,
        kind: machineKind,
        status: 'ACTIVE'
      }
    })

    await tx.machine.update({
      where: { id: machine.id },
      data: { assetId: asset.id }
    })

    await tx.assetBinding.create({
      data: {
        tenantId: registration.tenantId,
        assetId: asset.id,
        iotDeviceId: iotDevice.id,
        machineId: machine.id,
        reason: 'registered'
      }
    })

    await refreshIotDeviceStatus(tx, iotDevice.id)
    await refreshMachineStatus(tx, machine.id)

    await tx.deviceRegistrationCode.update({
      where: { id: registration.id },
      data: {
        status: 'USED',
        usedAt: new Date(),
        usedByIotDeviceId: iotDevice.id
      }
    })

    const generatedKey = generateDeviceApiKey()
    await tx.deviceApiKey.create({
      data: {
        iotDeviceId: iotDevice.id,
        keyPrefix: generatedKey.keyPrefix,
        secretHash: generatedKey.secretHash,
        label: 'Auto-generated at register'
      }
    })

    return { iotDevice, machine, asset, generatedKey }
  })

  return {
    ok: true,
    tenantCode: registration.tenant.code,
    merchantCode: registration.merchantAccount?.code || null,
    branchCode: registration.branch?.code || null,
    asset: {
      id: result.asset.id,
      code: result.asset.code,
      name: result.asset.name,
      assetUuid: result.asset.assetUuid
    },
    machine: {
      id: result.machine.id,
      code: result.machine.code,
      serialNo: result.machine.serialNo
    },
    device: {
      id: result.iotDevice.id,
      macAddress: result.iotDevice.macAddress,
      deviceUid: result.iotDevice.deviceUid
    },
    deviceApiKey: result.generatedKey.key
  }
})
