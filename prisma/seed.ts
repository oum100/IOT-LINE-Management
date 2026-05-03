import {
  PrismaClient,
  AssetStatus,
  DeviceBindingStatus,
  IotDeviceStatus,
  MachineStatus,
  MachineUnitStatus,
  MerchantStatus,
  TenantStatus,
  EnvironmentMode,
} from '@prisma/client'
import { hashPassword } from '../server/utils/password'

const prisma = new PrismaClient()

type PriceSpec = {
  amount: number
  duration: number
}

type TenantPlan = {
  tenantCode: string
  tenantName: string
  merchantCode: string
  merchantName: string
  branchCode: string
  branchName: string
  washerAssets: number
  dryerAssets: number
  spareIotDevices: number
}

const WASHER_PRICES: PriceSpec[] = [
  { amount: 30, duration: 35 },
  { amount: 40, duration: 60 },
  { amount: 50, duration: 90 },
]

const DRYER_PRICES: PriceSpec[] = [
  { amount: 40, duration: 60 },
  { amount: 50, duration: 75 },
  { amount: 60, duration: 90 },
]

const PLANS: TenantPlan[] = [
  {
    tenantCode: 'EITC',
    tenantName: 'E.I.T Consulting',
    merchantCode: 'SKV',
    merchantName: 'Skyview',
    branchCode: 'Skv001',
    branchName: 'Skyview',
    washerAssets: 5,
    dryerAssets: 5,
    spareIotDevices: 1,
  },
  {
    tenantCode: 'RGH18',
    tenantName: 'RegentHome 18',
    merchantCode: 'RGH',
    merchantName: 'RegentHome 18',
    branchCode: 'RGH001',
    branchName: 'RegentHome 18',
    washerAssets: 6,
    dryerAssets: 6,
    spareIotDevices: 0,
  },
]

function pad(n: number, width = 3) {
  return String(n).padStart(width, '0')
}

function assetUuidFrom(index: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let seed = (index + 1) * 10007
  let out = ''
  for (let i = 0; i < 15; i += 1) {
    seed = (seed * 48271) % 0x7fffffff
    out += chars[seed % chars.length]
  }
  return out
}

function macFrom(index: number) {
  const b3 = (index >> 16) & 0xff
  const b4 = (index >> 8) & 0xff
  const b5 = index & 0xff
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  return `3C:E9:0E:${toHex(b3)}:${toHex(b4)}:${toHex(b5)}`
}

async function clearAll() {
  const safe = async (job: () => Promise<unknown>) => {
    try {
      await job()
    } catch (error: any) {
      if (error?.code === 'P2021') return
      throw error
    }
  }

  await safe(() => prisma.deviceCommand.deleteMany())
  await safe(() => prisma.paymentSlip.deleteMany())
  await safe(() => prisma.payment.deleteMany())
  await safe(() => prisma.orderItem.deleteMany())
  await safe(() => prisma.order.deleteMany())

  await safe(() => prisma.machinePrice.deleteMany())
  await safe(() => prisma.machine.deleteMany())

  await safe(() => prisma.assetProductOffer.deleteMany())
  await safe(() => prisma.assetProductPrice.deleteMany())
  await safe(() => prisma.product.deleteMany())

  await safe(() => prisma.assetBinding.deleteMany())
  await safe(() => prisma.deviceApiKey.deleteMany())
  await safe(() => prisma.deviceRegistrationCode.deleteMany())
  await safe(() => prisma.machineUnit.deleteMany())
  await safe(() => prisma.iotDevice.deleteMany())

  await safe(() => prisma.branchBillerBinding.deleteMany())
  await safe(() => prisma.merchantBillerBinding.deleteMany())
  await safe(() => prisma.billerProfile.deleteMany())

  await safe(() => prisma.asset.deleteMany())
  await safe(() => prisma.branch.deleteMany())
  await safe(() => prisma.expense.deleteMany())
  await safe(() => prisma.expenseType.deleteMany())
  await safe(() => prisma.merchantAccount.deleteMany())
  await safe(() => prisma.tenant.deleteMany())

  await safe(() => prisma.session.deleteMany())
  await safe(() => prisma.account.deleteMany())
  await safe(() => prisma.user.deleteMany())
  await safe(() => prisma.verificationToken.deleteMany())

  await safe(() => prisma.machineKind.deleteMany())
}

async function seedMachineKinds() {
  const kinds = [
    { code: 'WASHER', name: 'Washer', sortOrder: 10 },
    { code: 'DRYER', name: 'Dryer', sortOrder: 20 },
    { code: 'WATER', name: 'Water', sortOrder: 30 },
    { code: 'VENDING', name: 'Vending', sortOrder: 40 },
  ]
  for (const kind of kinds) {
    await prisma.machineKind.create({ data: kind })
  }
}

async function seedPlatformAdmin() {
  const passwordHash = await hashPassword('P@ssw0rd')
  await prisma.user.create({
    data: {
      email: 'l.teerin@gmail.com',
      name: 'Platform Admin',
      role: 'ADMIN',
      passwordHash,
      isActive: true,
      emailVerified: new Date(),
      tenantId: null,
      merchantAccountId: null,
    },
  })
}

async function seedTenantBundle(plan: TenantPlan, seqOffset: number) {
  const tenant = await prisma.tenant.create({
    data: {
      code: plan.tenantCode,
      name: plan.tenantName,
      status: TenantStatus.ACTIVE,
    },
  })

  const merchant = await prisma.merchantAccount.create({
    data: {
      tenantId: tenant.id,
      code: plan.merchantCode,
      name: plan.merchantName,
      status: MerchantStatus.ACTIVE,
      environment: EnvironmentMode.LIVE,
    },
  })

  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      merchantAccountId: merchant.id,
      code: plan.branchCode,
      name: plan.branchName,
      status: 'ACTIVE',
    },
  })

  const expenseTypes = await Promise.all([
    prisma.expenseType.create({ data: { tenantId: tenant.id, code: 'ELEC', name: 'Electricity', sortOrder: 10 } }),
    prisma.expenseType.create({ data: { tenantId: tenant.id, code: 'WATER', name: 'Water', sortOrder: 20 } }),
    prisma.expenseType.create({ data: { tenantId: tenant.id, code: 'RENT', name: 'Space Rent', sortOrder: 30 } }),
    prisma.expenseType.create({ data: { tenantId: tenant.id, code: 'STAFF', name: 'Staff Salary', sortOrder: 40 } })
  ])

  const washerProducts = await Promise.all(
    WASHER_PRICES.map((price, idx) =>
      prisma.product.create({
        data: {
          tenantId: tenant.id,
          code: `${plan.tenantCode}-WP-${idx + 1}`,
          name: `Washer ${price.amount} THB / ${price.duration} min`,
          kind: 'WASHER',
          active: true,
        },
      })
    )
  )

  const dryerProducts = await Promise.all(
    DRYER_PRICES.map((price, idx) =>
      prisma.product.create({
        data: {
          tenantId: tenant.id,
          code: `${plan.tenantCode}-DP-${idx + 1}`,
          name: `Dryer ${price.amount} THB / ${price.duration} min`,
          kind: 'DRYER',
          active: true,
        },
      })
    )
  )

  const totalAssets = plan.washerAssets + plan.dryerAssets
  let localIotSeq = 1
  let localMachineSeq = 1

  for (let index = 0; index < totalAssets; index += 1) {
    const kind = index < plan.washerAssets ? 'WASHER' : 'DRYER'
    const number = kind === 'WASHER' ? index + 1 : index - plan.washerAssets + 1

    const asset = await prisma.asset.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        assetUuid: assetUuidFrom(seqOffset + index),
        code: `${plan.branchCode}-${pad(index + 1)}`,
        name: `${kind === 'WASHER' ? 'WM' : 'DM'}-${pad(number)}`,
        kind,
        status: AssetStatus.ACTIVE,
      },
    })

    const iotDevice = await prisma.iotDevice.create({
      data: {
        tenantId: tenant.id,
        macAddress: macFrom(seqOffset + index + 1),
        deviceUid: `${plan.tenantCode}-IOT-${pad(localIotSeq, 4)}`,
        status: IotDeviceStatus.IN_USE,
        fwVersion: 'v1.0.0',
        metadata: { source: 'seed' },
      },
    })
    localIotSeq += 1

    const machineUnit = await prisma.machineUnit.create({
      data: {
        tenantId: tenant.id,
        serialNo: `${plan.tenantCode}-MU-${pad(localMachineSeq, 5)}`,
        status: MachineUnitStatus.IN_USE,
        brand: 'Washpoint',
        model: kind,
      },
    })
    localMachineSeq += 1

    await prisma.assetBinding.create({
      data: {
        tenantId: tenant.id,
        assetId: asset.id,
        machineUnitId: machineUnit.id,
        iotDeviceId: iotDevice.id,
        status: DeviceBindingStatus.ACTIVE,
        startedAt: new Date(),
      },
    })

    const machine = await prisma.machine.create({
      data: {
        tenantId: tenant.id,
        merchantAccountId: merchant.id,
        branchId: branch.id,
        assetId: asset.id,
        code: `${plan.tenantCode}-SN-${pad(localMachineSeq + 7000, 8)}`,
        name: `${kind === 'WASHER' ? 'WM' : 'DM'}-${pad(number)}`,
        kind,
        status: MachineStatus.AVAILABLE,
        locationLabel: branch.name,
        topic: `iot/${plan.tenantCode}/${plan.branchCode}/${asset.code}`,
      },
    })

    const pricing = kind === 'WASHER' ? WASHER_PRICES : DRYER_PRICES
    const products = kind === 'WASHER' ? washerProducts : dryerProducts

    for (let pIndex = 0; pIndex < pricing.length; pIndex += 1) {
      const p = pricing[pIndex]!
      const product = products[pIndex]!

      await prisma.machinePrice.create({
        data: {
          machineId: machine.id,
          label: `${kind === 'WASHER' ? 'Wash' : 'Dry'} ${p.duration} min`,
          amount: p.amount,
          durationMinutes: p.duration,
          sortOrder: pIndex + 1,
        },
      })

      await prisma.assetProductPrice.create({
        data: {
          tenantId: tenant.id,
          assetId: asset.id,
          productId: product.id,
          amount: p.amount,
          durationMinutes: p.duration,
          sortOrder: pIndex + 1,
          active: true,
        },
      })
    }
  }

  for (let i = 0; i < plan.spareIotDevices; i += 1) {
    await prisma.iotDevice.create({
      data: {
        tenantId: tenant.id,
        macAddress: macFrom(seqOffset + totalAssets + i + 100),
        deviceUid: `${plan.tenantCode}-IOT-SPARE-${pad(i + 1, 3)}`,
        status: IotDeviceStatus.SPARE,
        fwVersion: 'v1.0.0',
        metadata: { source: 'seed', spare: true },
      },
    })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const expenseRows = [
    { code: 'ELEC', amount: 3200, offsetDay: 2, note: 'Monthly electricity bill' },
    { code: 'WATER', amount: 900, offsetDay: 3, note: 'Monthly water bill' },
    { code: 'RENT', amount: 8500, offsetDay: 1, note: 'Branch rent' },
    { code: 'STAFF', amount: 12000, offsetDay: 5, note: 'Staff payout' }
  ]

  for (const row of expenseRows) {
    const type = expenseTypes.find(item => item.code === row.code)
    if (!type) continue
    await prisma.expense.create({
      data: {
        tenantId: tenant.id,
        merchantAccountId: merchant.id,
        branchId: branch.id,
        expenseTypeId: type.id,
        amount: row.amount,
        occurredAt: new Date(monthStart.getFullYear(), monthStart.getMonth(), row.offsetDay),
        note: row.note
      }
    })
  }

  return {
    tenant,
    merchant,
    branch,
    assets: totalAssets,
    iot: totalAssets + plan.spareIotDevices,
    machineUnits: totalAssets,
    expenses: expenseRows.length
  }
}

async function main() {
  await clearAll()
  await seedMachineKinds()
  await seedPlatformAdmin()

  const first = await seedTenantBundle(PLANS[0]!, 0)
  const second = await seedTenantBundle(PLANS[1]!, 1000)

  console.log('Seed reset completed.')
  console.log(`Admin platform user: l.teerin@gmail.com / P@ssw0rd`)
  console.log(`Tenant ${first.tenant.code}: assets=${first.assets}, iot=${first.iot}, machineUnits=${first.machineUnits}, expenses=${first.expenses}`)
  console.log(`Tenant ${second.tenant.code}: assets=${second.assets}, iot=${second.iot}, machineUnits=${second.machineUnits}, expenses=${second.expenses}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
