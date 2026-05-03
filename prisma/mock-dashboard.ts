import {
  AppUserRole,
  AssetStatus,
  BillerStatus,
  BranchStatus,
  DeviceBindingStatus,
  EnvironmentMode,
  MerchantStatus,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ProviderCode,
  TenantStatus
} from '@prisma/client'

const prisma = new PrismaClient()

const isRefresh = process.argv.includes('--refresh')

const now = new Date()

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(items: T[]) {
  return items[randInt(0, items.length - 1)]!
}

function randomDateWithinLastYear() {
  const d = new Date(now)
  d.setDate(d.getDate() - randInt(0, 365))
  d.setHours(randInt(0, 23), randInt(0, 59), randInt(0, 59), 0)
  return d
}

function code(prefix: string, index: number, width = 4) {
  return `${prefix}-${String(index).padStart(width, '0')}`
}

async function clearAllData() {
  const preservedPlatformAdmins = await prisma.user.findMany({
    where: {
      role: AppUserRole.ADMIN,
      tenantId: null,
      merchantAccountId: null
    },
    select: { id: true }
  })
  const preservedIds = preservedPlatformAdmins.map(item => item.id)

  await prisma.paymentSlip.deleteMany()
  await prisma.deviceCommand.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.order.deleteMany()
  await prisma.machinePrice.deleteMany()
  await prisma.machine.deleteMany()
  await prisma.assetProductPrice.deleteMany()
  await prisma.assetBinding.deleteMany()
  await prisma.deviceApiKey.deleteMany()
  await prisma.deviceRegistrationCode.deleteMany()
  await prisma.branchBillerBinding.deleteMany()
  await prisma.merchantBillerBinding.deleteMany()
  await prisma.billerProfile.deleteMany()
  await prisma.asset.deleteMany()
  await prisma.iotDevice.deleteMany()
  await prisma.machineUnit.deleteMany()
  await prisma.product.deleteMany()
  if (preservedIds.length) {
    await prisma.session.deleteMany({ where: { userId: { notIn: preservedIds } } })
    await prisma.account.deleteMany({ where: { userId: { notIn: preservedIds } } })
    await prisma.user.deleteMany({ where: { id: { notIn: preservedIds } } })
  } else {
    await prisma.session.deleteMany()
    await prisma.account.deleteMany()
    await prisma.user.deleteMany()
  }
  await prisma.verificationToken.deleteMany()
  await prisma.branch.deleteMany()
  await prisma.merchantAccount.deleteMany()
  await prisma.tenant.deleteMany()
}

function merchantStatusByIndex(i: number) {
  if (i % 9 === 0) return MerchantStatus.SUSPENDED
  if (i % 13 === 0) return MerchantStatus.DISABLED
  return MerchantStatus.ACTIVE
}

function branchStatusByIndex(i: number) {
  if (i % 8 === 0) return BranchStatus.SUSPENDED
  if (i % 11 === 0) return BranchStatus.DISABLED
  return BranchStatus.ACTIVE
}

function assetStatusByIndex(i: number) {
  if (i % 10 === 0) return AssetStatus.MAINTENANCE
  if (i % 7 === 0) return AssetStatus.INACTIVE
  return AssetStatus.ACTIVE
}

function orderStatusWeighted(): OrderStatus {
  const roll = randInt(1, 100)
  if (roll <= 55) return OrderStatus.COMPLETED
  if (roll <= 68) return OrderStatus.IN_PROGRESS
  if (roll <= 78) return OrderStatus.CONFIRMED
  if (roll <= 88) return OrderStatus.PENDING_PAYMENT
  if (roll <= 95) return OrderStatus.SLIP_UPLOADED
  return OrderStatus.CANCELLED
}

function paymentStatusFromOrder(status: OrderStatus): PaymentStatus {
  if (status === OrderStatus.COMPLETED || status === OrderStatus.IN_PROGRESS || status === OrderStatus.CONFIRMED) return PaymentStatus.VERIFIED
  if (status === OrderStatus.SLIP_UPLOADED) return PaymentStatus.SLIP_UPLOADED
  if (status === OrderStatus.CANCELLED) return PaymentStatus.REJECTED
  return PaymentStatus.PENDING
}

async function seedMockData() {
  const existingTenants = await prisma.tenant.count()
  if (!isRefresh && existingTenants > 0) {
    throw new Error(
      'Database already has data. Use "bun run db:mock:refresh" to delete + reseed.'
    )
  }

  const tenantTotal = 5
  let merchantSeq = 1
  let branchSeq = 1
  let assetSeq = 1
  let deviceSeq = 1
  let machineSeq = 1
  let userSeq = 1
  let orderSeq = 1

  for (let t = 1; t <= tenantTotal; t += 1) {
    const tenantCode = code('TN', t, 5)
    const tenantStatus =
      t % 12 === 0 ? TenantStatus.DISABLED : t % 7 === 0 ? TenantStatus.SUSPENDED : TenantStatus.ACTIVE

    const tenant = await prisma.tenant.create({
      data: {
        code: tenantCode,
        name: `Tenant ${String(t).padStart(2, '0')}`,
        status: tenantStatus,
        metadata: {
          source: 'mock-dashboard',
          region: pick(['BKK', 'CNX', 'HKT', 'KKN'])
        }
      }
    })

    const productWash = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        code: 'P-WASH',
        name: 'Wash Program',
        kind: 'WASHER',
        active: true
      }
    })
    const productDry = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        code: 'P-DRY',
        name: 'Dry Program',
        kind: 'DRYER',
        active: true
      }
    })

    const billers = await Promise.all([
      prisma.billerProfile.create({
        data: {
          tenantId: tenant.id,
          code: `SLIP2GO-${t}`,
          displayName: `Slip2Go ${tenantCode}`,
          providerCode: ProviderCode.SLIP2GO,
          status: BillerStatus.ACTIVE,
          priority: 100
        }
      }),
      prisma.billerProfile.create({
        data: {
          tenantId: tenant.id,
          code: `MMN-${t}`,
          displayName: `MaeManee ${tenantCode}`,
          providerCode: ProviderCode.MAEMANEE,
          status: t % 5 === 0 ? BillerStatus.INACTIVE : BillerStatus.ACTIVE,
          priority: 120
        }
      })
    ])

    const merchantCount = randInt(2, 3)
    const merchants = []
    for (let m = 0; m < merchantCount; m += 1) {
      const merchant = await prisma.merchantAccount.create({
        data: {
          tenantId: tenant.id,
          code: code('MCH', merchantSeq, 4),
          name: `Merchant ${merchantSeq}`,
          status: merchantStatusByIndex(merchantSeq),
          environment: EnvironmentMode.TEST
        }
      })
      merchantSeq += 1
      merchants.push(merchant)

      await prisma.merchantBillerBinding.create({
        data: {
          tenantId: tenant.id,
          merchantAccountId: merchant.id,
          billerProfileId: billers[0]!.id,
          isDefault: true,
          active: true,
          priority: 100
        }
      })
    }

    const branches = []
    for (const merchant of merchants) {
      const branchCount = randInt(2, 3)
      for (let b = 0; b < branchCount; b += 1) {
        const branch = await prisma.branch.create({
          data: {
            tenantId: tenant.id,
            merchantAccountId: merchant.id,
            code: code('BR', branchSeq, 4),
            name: `Branch ${branchSeq}`,
            status: branchStatusByIndex(branchSeq)
          }
        })
        branchSeq += 1
        branches.push({ ...branch, merchantAccountId: merchant.id })

        await prisma.branchBillerBinding.create({
          data: {
            tenantId: tenant.id,
            branchId: branch.id,
            billerProfileId: billers[0]!.id,
            isDefault: true,
            active: true,
            priority: 100
          }
        })
      }
    }

    for (const branch of branches) {
      const assetCount = randInt(5, 9)
      for (let a = 0; a < assetCount; a += 1) {
        const kind = a % 2 === 0 ? 'WASHER' : 'DRYER'
        const asset = await prisma.asset.create({
          data: {
            tenantId: tenant.id,
            branchId: branch.id,
            assetUuid: `ASSET-${tenantCode}-${assetSeq}`,
            code: code('AS', assetSeq, 5),
            name: `${kind === 'WASHER' ? 'Washer' : 'Dryer'} ${assetSeq}`,
            kind,
            status: assetStatusByIndex(assetSeq)
          }
        })

        await prisma.assetProductPrice.createMany({
          data: [
            {
              tenantId: tenant.id,
              assetId: asset.id,
              productId: productWash.id,
              amount: randInt(20, 60),
              durationMinutes: randInt(30, 90),
              sortOrder: 1
            },
            {
              tenantId: tenant.id,
              assetId: asset.id,
              productId: productDry.id,
              amount: randInt(20, 60),
              durationMinutes: randInt(45, 90),
              sortOrder: 2
            }
          ]
        })

        const machineUnit = await prisma.machineUnit.create({
          data: {
            tenantId: tenant.id,
            serialNo: `SN-${tenantCode}-${machineSeq}`
          }
        })
        machineSeq += 1

        const iotDevice = await prisma.iotDevice.create({
          data: {
            tenantId: tenant.id,
            macAddress: `02:00:${String(deviceSeq).padStart(2, '0')}:${String(randInt(0, 99)).padStart(2, '0')}:${String(randInt(0, 99)).padStart(2, '0')}:${String(randInt(0, 99)).padStart(2, '0')}`,
            deviceUid: `DEV-${tenantCode}-${deviceSeq}`
          }
        })
        deviceSeq += 1

        const bindingRoll = randInt(1, 100)
        const createBinding = bindingRoll > 15
        if (createBinding) {
          const bindingStatus = bindingRoll > 80 ? DeviceBindingStatus.INACTIVE : DeviceBindingStatus.ACTIVE
          await prisma.assetBinding.create({
            data: {
              tenantId: tenant.id,
              assetId: asset.id,
              machineUnitId: machineUnit.id,
              iotDeviceId: iotDevice.id,
              status: bindingStatus,
              endedAt: bindingStatus === DeviceBindingStatus.INACTIVE ? randomDateWithinLastYear() : null
            }
          })
        }
        assetSeq += 1
      }
    }

    const userCount = randInt(3, 8)
    for (let u = 0; u < userCount; u += 1) {
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: `user${userSeq}@mock.local`,
          name: `Mock User ${userSeq}`,
          role: u === 0 ? AppUserRole.OWNER : AppUserRole.STAFF,
          isActive: u % 5 !== 0
        }
      })
      userSeq += 1
    }

    const orderCount = randInt(80, 180)
    for (let o = 0; o < orderCount; o += 1) {
      const branch = pick(branches)
      const merchant = merchants.find(item => item.id === branch.merchantAccountId) || merchants[0]!
      const createdAt = randomDateWithinLastYear()
      const orderStatus = orderStatusWeighted()
      const amount = randInt(30, 320)

      const order = await prisma.order.create({
        data: {
          tenantId: tenant.id,
          merchantAccountId: merchant.id,
          branchId: branch.id,
          orderNumber: code('ORD', orderSeq, 6),
          customerName: `Customer ${orderSeq}`,
          totalAmount: amount,
          status: orderStatus,
          createdAt
        }
      })

      await prisma.payment.create({
        data: {
          orderId: order.id,
          tenantId: tenant.id,
          merchantAccountId: merchant.id,
          branchId: branch.id,
          billerProfileId: billers[0]!.id,
          providerCode: 'MOCK',
          providerReference: `PAY-${orderSeq}`,
          amount,
          qrPayload: `MOCK-QR-${orderSeq}`,
          status: paymentStatusFromOrder(orderStatus),
          createdAt
        }
      })
      orderSeq += 1
    }
  }
}

async function main() {
  if (isRefresh) {
    await clearAllData()
  }
  await seedMockData()
}

main()
  .then(async () => {
    console.log(isRefresh ? 'Mock dashboard data refreshed.' : 'Mock dashboard data seeded.')
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
