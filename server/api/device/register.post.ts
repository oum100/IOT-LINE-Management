import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { generateDeviceApiKey, macToDeviceUid, normalizeMacAddress } from '../../utils/device-keys'
import { assertMachineKindExists } from '../../utils/machine-kind'
import { refreshIotDeviceStatus, refreshMachineStatus } from '../../utils/asset-lifecycle'

const baseSchema = z.object({
  registrationCode: z.string().trim().min(6),
  registerType: z.enum(['asset', 'iot', 'machine']),
  spare: z.boolean().optional().default(false)
})

const iotSchema = baseSchema.extend({
  registerType: z.literal('iot'),
  macAddress: z.string().trim().min(5),
  fwVersion: z.string().trim().min(1),
  name: z.string().trim().optional(),
  model: z.string().trim().optional()
})

const machineSchema = baseSchema.extend({
  registerType: z.literal('machine'),
  machineSerialNo: z.string().trim().min(1).max(140),
  machineBrand: z.string().trim().optional(),
  machineModel: z.string().trim().optional(),
  machineKind: z.string().trim().min(1).max(40).default('WASHER')
})

const assetSchema = baseSchema.extend({
  registerType: z.literal('asset'),
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

const schema = z.discriminatedUnion('registerType', [assetSchema, iotSchema, machineSchema])

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const registration = await prisma.deviceRegistrationCode.findUnique({
    where: { code: body.registrationCode },
    include: { branch: true, merchantAccount: true, tenant: true }
  })
  if (!registration) throw createError({ statusCode: 404, statusMessage: 'Invalid registration code' })
  if (registration.status !== 'READY') throw createError({ statusCode: 409, statusMessage: 'Registration code is not ready' })
  if (registration.expiresAt && registration.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Registration code expired' })
  }
  const scope = {
    tenant: { code: registration.tenant.code, name: registration.tenant.name },
    merchant: registration.merchantAccount ? { code: registration.merchantAccount.code, name: registration.merchantAccount.name } : null,
    branch: registration.branch ? { code: registration.branch.code, name: registration.branch.name } : null
  }

  if (body.registerType === 'iot') {
    const macAddress = normalizeMacAddress(body.macAddress)
    const deviceUid = macToDeviceUid(macAddress)
    const existing = await prisma.iotDevice.findUnique({
      where: { macAddress },
      select: { id: true, macAddress: true, deviceUid: true, status: true, metadata: true, tenant: { select: { code: true } } }
    })
    if (existing) {
      const metadata = (existing.metadata || {}) as Record<string, unknown>
      return {
        ok: true,
        reused: true,
        scope: {
          tenant: { code: existing.tenant?.code || registration.tenant.code, name: registration.tenant.name },
          merchant: {
            code: String(metadata.merchantCode || registration.merchantAccount?.code || '') || null,
            name: String(metadata.merchantName || registration.merchantAccount?.name || '') || null
          },
          branch: {
            code: String(metadata.branchCode || registration.branch?.code || '') || null,
            name: String(metadata.branchName || registration.branch?.name || '') || null
          }
        },
        merchantCode: String(metadata.merchantCode || registration.merchantAccount?.code || '') || null,
        branchCode: String(metadata.branchCode || registration.branch?.code || '') || null,
        device: { id: existing.id, macAddress: existing.macAddress, deviceUid: existing.deviceUid, status: existing.status },
        deviceApiKey: null
      }
    }
    const result = await prisma.$transaction(async (tx) => {
      const device = await tx.iotDevice.create({
        data: {
          tenantId: registration.tenantId,
          macAddress,
          deviceUid,
          name: body.name || `IOT-${deviceUid}`,
          model: body.model || null,
          fwVersion: body.fwVersion,
          status: body.spare ? 'SPARE' : 'NEW',
          metadata: {
            source: body.spare ? 'register-iot-spare' : 'register-iot-new',
            merchantAccountId: registration.merchantAccountId || null,
            branchId: registration.branchId || null,
            merchantCode: registration.merchantAccount?.code || null,
            merchantName: registration.merchantAccount?.name || null,
            branchCode: registration.branch?.code || null,
            branchName: registration.branch?.name || null
          }
        }
      })
      await tx.deviceRegistrationCode.update({
        where: { id: registration.id },
        data: { status: 'USED', usedAt: new Date(), usedByIotDeviceId: device.id }
      })
      const generatedKey = generateDeviceApiKey()
      await tx.deviceApiKey.create({
        data: {
          iotDeviceId: device.id,
          keyPrefix: generatedKey.keyPrefix,
          secretHash: generatedKey.secretHash,
          label: 'Auto-generated at register'
        }
      })
      return { device, generatedKey }
    })
    return {
      ok: true,
      scope,
      merchantCode: registration.merchantAccount?.code || null,
      branchCode: registration.branch?.code || null,
      device: { id: result.device.id, macAddress: result.device.macAddress, deviceUid: result.device.deviceUid, status: result.device.status },
      deviceApiKey: result.generatedKey.key
    }
  }

  if (body.registerType === 'machine') {
    const machineKind = await assertMachineKindExists(body.machineKind)
    const existing = await prisma.machine.findUnique({
      where: { serialNo: body.machineSerialNo },
      select: { id: true, serialNo: true, status: true, tenant: { select: { code: true } } }
    })
    if (existing) {
      return {
        ok: true,
        reused: true,
        scope,
        machine: { id: existing.id, serialNo: existing.serialNo, status: existing.status }
      }
    }
    const unit = await prisma.machine.create({
      data: {
        tenantId: registration.tenantId,
        code: `MU-${body.machineSerialNo.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || Date.now().toString().slice(-6)}`,
        name: body.machineSerialNo,
        serialNo: body.machineSerialNo,
        brand: body.machineBrand || null,
        model: body.machineModel || null,
        kind: machineKind,
        locationLabel: 'Unassigned',
        status: body.spare ? 'SPARE' : 'NEW'
      }
    })
    await prisma.deviceRegistrationCode.update({
      where: { id: registration.id },
      data: { status: 'USED', usedAt: new Date() }
    })
    return { ok: true, scope, machine: { id: unit.id, serialNo: unit.serialNo, status: unit.status } }
  }

  if (!registration.branchId) throw createError({ statusCode: 400, statusMessage: 'Registration code missing branch assignment' })
  const machineKind = await assertMachineKindExists(body.machineKind)
  const macAddress = normalizeMacAddress(body.macAddress)
  const deviceUid = macToDeviceUid(macAddress)
  const machineCode = `MC-${machineKind}-${body.machineSerialNo.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`
  const assetCode = `AS-${deviceUid.slice(-8)}`
  const [existingDevice, existingMachine, existingAsset] = await Promise.all([
    prisma.iotDevice.findUnique({ where: { macAddress }, select: { id: true } }),
    prisma.machine.findUnique({ where: { serialNo: body.machineSerialNo }, select: { id: true } }),
    prisma.asset.findUnique({ where: { assetUuid: deviceUid }, select: { id: true } })
  ])
  if (existingDevice || existingMachine || existingAsset) {
    const existingBinding = await prisma.assetBinding.findFirst({
      where: {
        tenantId: registration.tenantId,
        status: 'ACTIVE',
        endedAt: null,
        OR: [
          ...(existingDevice ? [{ iotDeviceId: existingDevice.id }] : []),
          ...(existingMachine ? [{ machineId: existingMachine.id }] : []),
          ...(existingAsset ? [{ assetId: existingAsset.id }] : [])
        ]
      },
      include: {
        asset: true,
        machine: true,
        iotDevice: true
      }
    })
    if (existingBinding?.asset && existingBinding?.machine && existingBinding?.iotDevice) {
      return {
        ok: true,
        reused: true,
        scope,
        asset: {
          id: existingBinding.asset.id,
          code: existingBinding.asset.code,
          name: existingBinding.asset.name,
          assetUuid: existingBinding.asset.assetUuid
        },
        machine: {
          id: existingBinding.machine.id,
          code: existingBinding.machine.code,
          serialNo: existingBinding.machine.serialNo,
          status: existingBinding.machine.status
        },
        device: {
          id: existingBinding.iotDevice.id,
          macAddress: existingBinding.iotDevice.macAddress,
          deviceUid: existingBinding.iotDevice.deviceUid,
          status: existingBinding.iotDevice.status
        }
      }
    }
    throw createError({ statusCode: 409, statusMessage: 'Duplicate registration data exists but no active binding found' })
  }

  const result = await prisma.$transaction(async (tx) => {
    const iotDevice = await tx.iotDevice.create({
      data: {
        tenantId: registration.tenantId,
        macAddress,
        deviceUid,
        name: body.iotName || `IOT-${deviceUid}`,
        model: body.iotModel || machineKind,
        fwVersion: body.fwVersion || null,
        status: body.spare ? 'SPARE' : 'NEW',
        metadata: { source: body.spare ? 'register-asset-spare' : 'register-asset' }
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
        status: body.spare ? 'SPARE' : 'NEW',
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
    await tx.machine.update({ where: { id: machine.id }, data: { assetId: asset.id } })
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
      data: { status: 'USED', usedAt: new Date(), usedByIotDeviceId: iotDevice.id }
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
    scope,
    asset: { id: result.asset.id, code: result.asset.code, name: result.asset.name, assetUuid: result.asset.assetUuid },
    machine: { id: result.machine.id, code: result.machine.code, serialNo: result.machine.serialNo, status: result.machine.status },
    device: { id: result.iotDevice.id, macAddress: result.iotDevice.macAddress, deviceUid: result.iotDevice.deviceUid, status: result.iotDevice.status },
    deviceApiKey: result.generatedKey.key
  }
})
