import { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export type AssignmentStatus = 'UNASSIGNED' | 'PARTIAL_ASSIGNED' | 'ASSIGNED'

export function overlaps(startA: Date, endA: Date | null, startB: Date, endB: Date | null) {
  const aEnd = endA ?? new Date('9999-12-31T23:59:59.999Z')
  const bEnd = endB ?? new Date('9999-12-31T23:59:59.999Z')
  return startA <= bEnd && startB <= aEnd
}

export async function lockAssetForUpdate(tx: Tx, assetId: string) {
  await tx.$queryRaw`
    SELECT id
    FROM "assets"
    WHERE id = ${assetId}
    FOR UPDATE
  `
}

export async function lockDeviceForUpdate(tx: Tx, deviceId: string) {
  await tx.$queryRaw`
    SELECT id
    FROM "iot_devices"
    WHERE id = ${deviceId}
    FOR UPDATE
  `
}

export async function lockMachineForUpdate(tx: Tx, machineId: string) {
  await tx.$queryRaw`
    SELECT id
    FROM "Machine"
    WHERE id = ${machineId}
    FOR UPDATE
  `
}

export async function lockAssetBindingRowsForUpdate(tx: Tx, assetId: string, deviceId?: string | null, machineId?: string | null) {
  await tx.$queryRaw`
    SELECT id
    FROM "asset_bindings"
    WHERE "assetId" = ${assetId}
       OR "iotDeviceId" = ${deviceId || null}
       OR "machineId" = ${machineId || null}
    FOR UPDATE
  `
}

export function resolveAssignmentStatus(input: { hasIotDevice: boolean; hasMachine: boolean }): AssignmentStatus {
  if (input.hasIotDevice && input.hasMachine) return 'ASSIGNED'
  if (!input.hasIotDevice && !input.hasMachine) return 'UNASSIGNED'
  return 'PARTIAL_ASSIGNED'
}

export async function readIotDeviceStatus(tx: Tx, deviceId: string): Promise<string | null> {
  try {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status"::text AS status
      FROM "iot_devices"
      WHERE id = ${deviceId}
      LIMIT 1
    `
    return rows[0]?.status || null
  } catch {
    return null
  }
}

export async function readMachineStatus(tx: Tx, machineId: string): Promise<string | null> {
  try {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status"::text AS status
      FROM "Machine"
      WHERE id = ${machineId}
      LIMIT 1
    `
    return rows[0]?.status || null
  } catch {
    return null
  }
}

export async function refreshIotDeviceStatus(tx: Tx, deviceId: string) {
  const current = await readIotDeviceStatus(tx, deviceId)
  if (!current) return
  if (current === 'DISABLED' || current === 'OFFLINE') return

  const activeBinding = await tx.assetBinding.findFirst({
    where: {
      iotDeviceId: deviceId,
      status: 'ACTIVE',
      endedAt: null
    },
    select: { id: true }
  })
  try {
    await tx.$executeRaw`
      UPDATE "iot_devices"
      SET "status" = ${activeBinding ? 'BOUND' : 'SPARE'}::"IotDeviceStatus"
      WHERE id = ${deviceId}
    `
  } catch {
    // status column may not exist yet in transitional environments
  }
}

export async function refreshMachineStatus(tx: Tx, machineId: string) {
  const current = await readMachineStatus(tx, machineId)
  if (!current) return
  if (current === 'DISABLED' || current === 'OFFLINE') return

  const activeBinding = await tx.assetBinding.findFirst({
    where: {
      machineId,
      status: 'ACTIVE',
      endedAt: null
    },
    select: { id: true }
  })
  try {
    await tx.$executeRaw`
      UPDATE "Machine"
      SET "status" = ${activeBinding ? 'BOUND' : 'SPARE'}::"MachineStatus"
      WHERE id = ${machineId}
    `
  } catch {
    // status column may not exist yet in transitional environments
  }
}
