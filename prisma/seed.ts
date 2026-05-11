import {
  PrismaClient,
  AssetStatus,
  DeviceBindingStatus,
  EnvironmentMode,
  IotDeviceStatus,
  MachineStatus,
  MerchantStatus,
  OrderItemStatus,
  OrderStatus,
  PaymentStatus,
  TenantStatus,
} from '@prisma/client'
import { hashPassword } from '../server/utils/password'
import { macToDeviceUid } from '../server/utils/device-keys'

const prisma = new PrismaClient()

type BranchPlan = {
  code: string
  name: string
  washer: number
  dryer: number
}

type MerchantPlan = {
  code: string
  name: string
  branches: BranchPlan[]
}

type TenantPlan = {
  code: string
  name: string
  merchants: MerchantPlan[]
}

const TENANTS: TenantPlan[] = [
  {
    code: 'EIT',
    name: 'EIT',
    merchants: [
      { code: 'WPT', name: 'WashPoint', branches: [{ code: 'WPT01', name: 'WashPoint', washer: 3, dryer: 3 }] },
      { code: 'SKV', name: 'SKYVIEW', branches: [{ code: 'SKV01', name: 'SKYVIEW', washer: 12, dryer: 8 }] },
      { code: 'RGH18', name: 'RGH18', branches: [{ code: 'RGH01', name: 'RGH18', washer: 6, dryer: 6 }] },
    ],
  },
  {
    code: 'PTT',
    name: 'PTT',
    merchants: [
      {
        code: 'WPTT',
        name: 'WashPTT',
        branches: [
          { code: 'WPA', name: 'Branch A', washer: 4, dryer: 4 },
          { code: 'WPB', name: 'Branch B', washer: 3, dryer: 3 },
        ],
      },
      {
        code: 'WE',
        name: 'WashEasy',
        branches: [
          { code: 'WEA', name: 'WashEasy A', washer: 6, dryer: 6 },
          { code: 'WEB', name: 'WashEasy B', washer: 6, dryer: 6 },
          { code: 'WEC', name: 'WashEasy C', washer: 6, dryer: 6 },
        ],
      },
    ],
  },
]

const WASHER_PRODUCTS = [
  { code: 'WASH-30-35', name: 'Wash-30-35 : Wash 30 Baht 35 Mins', amount: 30, durationMinutes: 35 },
  { code: 'WASH-40-60', name: 'Wash-40-60 : Wash 40 Baht 60 Mins', amount: 40, durationMinutes: 60 },
  { code: 'WASH-50-90', name: 'Wash-50-90 : Wash 50 Baht 90 Mins', amount: 50, durationMinutes: 90 },
]

const DRYER_PRODUCTS = [
  { code: 'DRY-40-60', name: 'Dry-40-60 : Wash 40 Baht 60 Mins', amount: 40, durationMinutes: 60 },
  { code: 'DRY-50-75', name: 'Dry-50-75 : Wash 50 Baht 75 Mins', amount: 50, durationMinutes: 75 },
  { code: 'DRY-60-90', name: 'Dry-60-90 : Wash 60 Baht 90 Mins', amount: 60, durationMinutes: 90 },
]

function pad(n: number, width = 3) {
  return String(n).padStart(width, '0')
}

function assetUuidFrom(index: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let seed = (index + 1) * 7919
  let out = ''
  for (let i = 0; i < 15; i += 1) {
    seed = (seed * 48271) % 0x7fffffff
    out += chars[seed % chars.length]
  }
  return out
}

function macFrom(index: number) {
  const b0 = 0xaa
  const b1 = 0xaa
  const b2 = 0xaa
  const b3 = (index >> 16) & 0xff
  const b4 = (index >> 8) & 0xff
  const b5 = index & 0xff
  const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  return `${hex(b0)}:${hex(b1)}:${hex(b2)}:${hex(b3)}:${hex(b4)}:${hex(b5)}`
}

function serial13(seed: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let x = (seed + 1) * 104729
  let out = ''
  for (let i = 0; i < 13; i += 1) {
    x = (x * 48271) % 0x7fffffff
    out += chars[x % chars.length]
  }
  return out
}

async function clearBusinessData() {
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
  await safe(() => prisma.iotDevice.deleteMany())

  await safe(() => prisma.branchBillerBinding.deleteMany())
  await safe(() => prisma.merchantBillerBinding.deleteMany())
  await safe(() => prisma.tenantBillerBinding.deleteMany())
  await safe(() => prisma.providerConnection.deleteMany())
  await safe(() => prisma.providerService.deleteMany())
  await safe(() => prisma.slipVerifyConnection.deleteMany())
  await safe(() => prisma.billerProfile.deleteMany())

  await safe(() => prisma.asset.deleteMany())
  await safe(() => prisma.branch.deleteMany())
  await safe(() => prisma.expense.deleteMany())
  await safe(() => prisma.expenseType.deleteMany())
  await safe(() => prisma.productType.deleteMany())
  await safe(() => prisma.serviceUnitType.deleteMany())
  await safe(() => prisma.serviceModeType.deleteMany())
  await safe(() => prisma.merchantAccount.deleteMany())
  await safe(() => prisma.tenant.deleteMany())

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

async function seedProductDimensions() {
  const productTypes = [
    { code: 'WASHER', name: 'Washer', sortOrder: 10 },
    { code: 'DRYER', name: 'Dryer', sortOrder: 20 },
    { code: 'WATER', name: 'Water', sortOrder: 30 },
    { code: 'VENDING', name: 'Vending', sortOrder: 40 },
    { code: 'ICE', name: 'Ice', sortOrder: 100 },
  ]
  const serviceModes = [
    { code: 'TIME', name: 'Time', sortOrder: 10 },
    { code: 'QUANTITY', name: 'Quantity', sortOrder: 20 },
    { code: 'UNIT', name: 'Unit', sortOrder: 30 },
  ]
  const serviceUnits = [
    { code: 'MINUTE', name: 'Minute', symbol: 'min', sortOrder: 10 },
    { code: 'SECOND', name: 'Second', symbol: 'sec', sortOrder: 20 },
    { code: 'LITER', name: 'Liter', symbol: 'L', sortOrder: 30 },
    { code: 'GRAM', name: 'Gram', symbol: 'g', sortOrder: 40 },
    { code: 'PIECE', name: 'Piece', symbol: null, sortOrder: 50 },
    { code: 'BOX', name: 'Box', symbol: null, sortOrder: 60 },
    { code: 'SLOT', name: 'Slot', symbol: null, sortOrder: 70 },
    { code: 'UNIT', name: 'Unit', symbol: null, sortOrder: 80 },
  ]

  for (const type of productTypes) {
    await prisma.productType.create({ data: type })
  }
  for (const mode of serviceModes) {
    await prisma.serviceModeType.create({ data: mode })
  }
  for (const unit of serviceUnits) {
    await prisma.serviceUnitType.create({ data: unit })
  }
}

async function seedUsers(eitTenantId: string) {
  const passwordHash = await hashPassword('P@ssw0rd')

  await prisma.user.upsert({
    where: { email: 'l.teerin@gmail.com' },
    create: {
      email: 'l.teerin@gmail.com',
      name: 'Platform Admin',
      role: 'ADMIN',
      passwordHash,
      isActive: true,
      emailVerified: new Date(),
      tenantId: null,
      merchantAccountId: null,
    },
    update: {
      name: 'Platform Admin',
      role: 'ADMIN',
      passwordHash,
      isActive: true,
      emailVerified: new Date(),
      tenantId: null,
      merchantAccountId: null,
    },
  })

  await prisma.user.upsert({
    where: { email: 'oum100@gmail.com' },
    create: {
      email: 'oum100@gmail.com',
      name: 'Tenant Owner',
      role: 'OWNER',
      passwordHash,
      isActive: true,
      emailVerified: new Date(),
      tenantId: eitTenantId,
      merchantAccountId: null,
    },
    update: {
      name: 'Tenant Owner',
      role: 'OWNER',
      passwordHash,
      isActive: true,
      emailVerified: new Date(),
      tenantId: eitTenantId,
      merchantAccountId: null,
    },
  })
}

async function createTenantProducts(tenantId: string, tenantCode: string) {
  const washer = await Promise.all(
    WASHER_PRODUCTS.map((p) =>
      prisma.product.create({
        data: {
          tenantId,
          code: `${tenantCode}-${p.code}`,
          name: p.name,
          kind: 'WASHER',
          amount: p.amount,
          durationMinutes: p.durationMinutes,
          serviceMode: 'TIME',
          serviceUnit: 'MINUTE',
          quantity: null,
          active: true,
        },
      })
    )
  )

  const dryer = await Promise.all(
    DRYER_PRODUCTS.map((p) =>
      prisma.product.create({
        data: {
          tenantId,
          code: `${tenantCode}-${p.code}`,
          name: p.name,
          kind: 'DRYER',
          amount: p.amount,
          durationMinutes: p.durationMinutes,
          serviceMode: 'TIME',
          serviceUnit: 'MINUTE',
          quantity: null,
          active: true,
        },
      })
    )
  )

  return { washer, dryer }
}

async function createAssetBundle(input: {
  tenantId: string
  tenantCode: string
  merchantId: string
  branchId: string
  branchCode: string
  branchName: string
  kind: 'WASHER' | 'DRYER'
  count: number
  codeStartAt: number
  startIndex: number
  products: Array<{ id: string; amount: number | null; durationMinutes: number | null }>
}) {
  let globalIndex = input.startIndex

  for (let i = 0; i < input.count; i += 1) {
    const serial = serial13(globalIndex)
    const mac = macFrom(globalIndex)
    const deviceUid = macToDeviceUid(mac)
    const assetCode = `${input.branchCode}-${pad(input.codeStartAt + i, 4)}`
    const assetName = `${input.kind === 'WASHER' ? 'WM' : 'DM'}-${pad(i + 1, 3)}`

    const asset = await prisma.asset.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        assetUuid: assetUuidFrom(globalIndex),
        code: assetCode,
        name: assetName,
        kind: input.kind,
        status: AssetStatus.ACTIVE,
      },
    })

    const iot = await prisma.iotDevice.create({
      data: {
        tenantId: input.tenantId,
        macAddress: mac,
        deviceUid,
        status: IotDeviceStatus.BOUND,
        fwVersion: '1.0.0',
        name: `IOT-${assetName}`,
        model: input.kind,
      },
    })

    const machine = await prisma.machine.create({
      data: {
        tenantId: input.tenantId,
        merchantAccountId: input.merchantId,
        branchId: input.branchId,
        assetId: asset.id,
        code: `${input.tenantCode}-MCH-${pad(globalIndex, 6)}`,
        name: serial,
        serialNo: serial,
        brand: input.tenantCode,
        model: input.kind,
        kind: input.kind,
        status: MachineStatus.BOUND,
        locationLabel: input.branchName,
        topic: `iot/${deviceUid}`,
      },
    })

    await prisma.assetBinding.create({
      data: {
        tenantId: input.tenantId,
        assetId: asset.id,
        machineId: machine.id,
        iotDeviceId: iot.id,
        status: DeviceBindingStatus.ACTIVE,
      },
    })

    for (let pIndex = 0; pIndex < input.products.length; pIndex += 1) {
      const p = input.products[pIndex]!
      const amount = p.amount || 0
      const duration = p.durationMinutes || 0
      await prisma.machinePrice.create({
        data: {
          machineId: machine.id,
          label: `${input.kind}-${amount}-${duration}`,
          amount,
          durationMinutes: duration,
          sortOrder: pIndex + 1,
        },
      })

      await prisma.assetProductPrice.create({
        data: {
          tenantId: input.tenantId,
          assetId: asset.id,
          productId: p.id,
          amount,
          durationMinutes: duration,
          serviceMode: 'TIME',
          serviceUnit: 'MINUTE',
          quantity: null,
          sortOrder: pIndex + 1,
          active: true,
        },
      })
    }

    globalIndex += 1
  }

  return globalIndex
}

async function seedOrdersForBranch(input: {
  tenantId: string
  merchantId: string
  branchId: string
  branchCode: string
  assets: Array<{
    id: string
    machineId: string
    machinePrices: Array<{ id: string; label: string; amount: number; durationMinutes: number }>
  }>
  startOrderSeq: number
  orderCount: number
}) {
  let seq = input.startOrderSeq
  for (let i = 0; i < input.orderCount; i += 1) {
    const asset = input.assets[i % input.assets.length]!
    const price = asset.machinePrices[i % asset.machinePrices.length]!

    const order = await prisma.order.create({
      data: {
        tenantId: input.tenantId,
        merchantAccountId: input.merchantId,
        branchId: input.branchId,
        orderNumber: `ORD-${input.branchCode}-${pad(seq, 6)}`,
        customerName: `Customer ${pad(seq, 4)}`,
        totalAmount: price.amount,
        status: OrderStatus.COMPLETED,
      },
    })

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        machineId: asset.machineId,
        assetId: asset.id,
        priceId: price.id,
        priceLabel: price.label,
        amount: price.amount,
        durationMinutes: price.durationMinutes,
        status: OrderItemStatus.COMPLETED,
        startedAt: new Date(Date.now() - 1000 * 60 * 30),
        completedAt: new Date(),
      },
    })

    await prisma.payment.create({
      data: {
        orderId: order.id,
        tenantId: input.tenantId,
        merchantAccountId: input.merchantId,
        branchId: input.branchId,
        amount: price.amount,
        qrPayload: `MOCKQR-${order.orderNumber}`,
        status: PaymentStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    })

    seq += 1
  }

  return seq
}

async function main() {
  await clearBusinessData()
  await seedMachineKinds()
  await seedProductDimensions()

  let assetGlobalIndex = 1
  let orderSeq = 1
  let eitTenantId = ''

  for (const tenantPlan of TENANTS) {
    const tenant = await prisma.tenant.create({
      data: {
        code: tenantPlan.code,
        name: tenantPlan.name,
        status: TenantStatus.ACTIVE,
      },
    })

    if (tenantPlan.code === 'EIT') eitTenantId = tenant.id

    const products = await createTenantProducts(tenant.id, tenantPlan.code)

    for (const merchantPlan of tenantPlan.merchants) {
      const merchant = await prisma.merchantAccount.create({
        data: {
          tenantId: tenant.id,
          code: merchantPlan.code,
          name: merchantPlan.name,
          status: MerchantStatus.ACTIVE,
          environment: EnvironmentMode.LIVE,
        },
      })

      for (const branchPlan of merchantPlan.branches) {
        const branch = await prisma.branch.create({
          data: {
            tenantId: tenant.id,
            merchantAccountId: merchant.id,
            code: branchPlan.code,
            name: branchPlan.name,
            status: 'ACTIVE',
          },
        })

        assetGlobalIndex = await createAssetBundle({
          tenantId: tenant.id,
          tenantCode: tenantPlan.code,
          merchantId: merchant.id,
          branchId: branch.id,
          branchCode: branchPlan.code,
          branchName: branchPlan.name,
          kind: 'WASHER',
          count: branchPlan.washer,
          codeStartAt: 1,
          startIndex: assetGlobalIndex,
          products: products.washer,
        })

        assetGlobalIndex = await createAssetBundle({
          tenantId: tenant.id,
          tenantCode: tenantPlan.code,
          merchantId: merchant.id,
          branchId: branch.id,
          branchCode: branchPlan.code,
          branchName: branchPlan.name,
          kind: 'DRYER',
          count: branchPlan.dryer,
          codeStartAt: branchPlan.washer + 1,
          startIndex: assetGlobalIndex,
          products: products.dryer,
        })

        const branchAssets = await prisma.asset.findMany({
          where: { branchId: branch.id },
          select: {
            id: true,
            machines: {
              select: {
                id: true,
                prices: {
                  select: { id: true, label: true, amount: true, durationMinutes: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
              take: 1,
            },
          },
          orderBy: { createdAt: 'asc' },
        })

        const orderAssets = branchAssets
          .map((a) => ({
            id: a.id,
            machineId: a.machines[0]?.id || '',
            machinePrices: a.machines[0]?.prices || [],
          }))
          .filter((a) => a.machineId && a.machinePrices.length)

        const orderCount = 10 + (orderSeq % 6)
        orderSeq = await seedOrdersForBranch({
          tenantId: tenant.id,
          merchantId: merchant.id,
          branchId: branch.id,
          branchCode: branch.code,
          assets: orderAssets,
          startOrderSeq: orderSeq,
          orderCount,
        })
      }
    }
  }

  if (eitTenantId) {
    await seedUsers(eitTenantId)
  }

  console.log('Seed completed: EIT/PTT structure with products, assets, IoT, machines, and orders.')
  console.log('Platform admin: l.teerin@gmail.com / P@ssw0rd')
  console.log('Portal owner: oum100@gmail.com / P@ssw0rd')
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
