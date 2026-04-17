import { PrismaClient, ProviderCode } from "@prisma/client"

const prisma = new PrismaClient()

const TENANT_CODES = ["Company-A", "Company-B", "Company-C", "Company-D", "Company-E"]
const MERCHANT_BASE_NAMES = ["WashPoint", "WashCoin", "TrendyWash", "Wash Enjoy", "Wash Bear"]
const BRANCH_NAME_POOL = [
  "City Hub",
  "Market Walk",
  "Green Park",
  "Sunset Lane",
  "Riverfront",
  "Downtown",
  "North Point",
  "East Gate",
  "West End",
  "South Station",
  "The Corner",
  "Metro Mall",
  "Town Square",
  "Palm View",
  "Central Zone",
]

const WASH_PRICES = [20, 30, 40, 50]
const DRY_PRICES = [40, 50, 60]
const MACHINE_DISPLAY_TYPES = ["Washer", "Dryer", "Water", "Vending"]
const MACHINE_KIND_CODES = ["WASHER", "DRYER", "WATER", "VENDING"]
const TENANT_MERCHANT_BRANCH_PLAN: number[][] = [
  [3],          // Company-A: M1, B3
  [2, 2],       // Company-B: M2, B4
  [4, 2],       // Company-C: M2, B6
  [3, 2, 2],    // Company-D: M3, B7
  [3, 3, 2, 2], // Company-E: M4, B10
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}

function toMac(index: number) {
  if (index === 0) return "3C:E9:0E:54:C5:54"
  const b3 = (index >> 16) & 0xff
  const b4 = (index >> 8) & 0xff
  const b5 = index & 0xff
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase()
  return `3C:E9:0E:${toHex(b3)}:${toHex(b4)}:${toHex(b5)}`
}

function toAssetUuid(index: number) {
  if (index === 0) return "KYBTVVBC5J8F3EC"
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"
  let out = ""
  let seed = index * 7919 + 11
  for (let i = 0; i < 15; i += 1) {
    seed = (seed * 48271) % 0x7fffffff
    out += chars[seed % chars.length]
  }
  return out
}

async function clearData() {
  await prisma.deviceCommand.deleteMany()
  await prisma.paymentSlip.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.machinePrice.deleteMany()
  await prisma.machine.deleteMany()
  await prisma.assetProductPrice.deleteMany()
  await prisma.product.deleteMany()
  await prisma.assetBinding.deleteMany()
  await prisma.deviceApiKey.deleteMany()
  await prisma.deviceRegistrationCode.deleteMany()
  await prisma.machineUnit.deleteMany()
  await prisma.iotDevice.deleteMany()
  await prisma.branchBillerBinding.deleteMany()
  await prisma.merchantBillerBinding.deleteMany()
  await prisma.billerProfile.deleteMany()
  await prisma.asset.deleteMany()
  await prisma.branch.deleteMany()
  await prisma.merchantAccount.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.machineKind.deleteMany()
}

async function main() {
  await clearData()

  for (let i = 0; i < MACHINE_KIND_CODES.length; i += 1) {
    const code = MACHINE_KIND_CODES[i]!
    await prisma.machineKind.create({
      data: {
        code,
        name: code.charAt(0) + code.slice(1).toLowerCase(),
        sortOrder: 10 + i,
        active: true,
      },
    })
  }

  const tenants = []
  for (const code of TENANT_CODES) {
    const tenant = await prisma.tenant.create({
      data: {
        code,
        name: code,
        status: "ACTIVE",
      },
    })
    tenants.push(tenant)
  }

  const merchants: Array<{ id: string; tenantId: string; code: string; name: string; status: string; environment: string; plannedBranches: number }> = []
  for (let tIndex = 0; tIndex < tenants.length; tIndex += 1) {
    const tenant = tenants[tIndex]!
    const branchPlan = TENANT_MERCHANT_BRANCH_PLAN[tIndex] || [3]
    for (let mIndex = 0; mIndex < branchPlan.length; mIndex += 1) {
      const baseName = MERCHANT_BASE_NAMES[mIndex % MERCHANT_BASE_NAMES.length]!
      const tenantSuffix = tenant.code.replace("Company-", "").trim()
      const uniqueName = `${baseName} ${tenantSuffix}`
      const code = `${baseName.replace(/\s+/g, "")}-${tenantSuffix}`.toUpperCase()
      const merchant = await prisma.merchantAccount.create({
        data: {
          tenantId: tenant.id,
          code,
          name: uniqueName,
          status: Math.random() < 0.88 ? "ACTIVE" : "SUSPENDED",
          environment: Math.random() < 0.7 ? "LIVE" : "TEST",
        },
      })
      merchants.push({
        ...merchant,
        plannedBranches: branchPlan[mIndex] || 2,
      })
    }
  }

  const billerProfiles = []
  for (const tenant of tenants) {
    for (let i = 0; i < 3; i += 1) {
      const biller = await prisma.billerProfile.create({
        data: {
          tenantId: tenant.id,
          code: `BILL-${tenant.code}-${String(i + 1).padStart(2, "0")}`,
          displayName: `${tenant.code} Biller ${i + 1}`,
          providerCode: i % 2 === 0 ? ProviderCode.PROMPTPAY : ProviderCode.INTERNAL,
          status: i === 2 ? "INACTIVE" : "ACTIVE",
          priority: 100 + i,
        },
      })
      billerProfiles.push(biller)
    }
  }

  for (const merchant of merchants) {
    const tenantBillers = billerProfiles.filter((b) => b.tenantId === merchant.tenantId)
    const target = tenantBillers[0]
    if (!target) continue
    await prisma.merchantBillerBinding.create({
      data: {
        tenantId: merchant.tenantId,
        merchantAccountId: merchant.id,
        billerProfileId: target.id,
        isDefault: true,
        active: true,
        priority: 100,
      },
    })
  }

  const branches = []
  let branchSeq = 1
  for (let tIndex = 0; tIndex < tenants.length; tIndex += 1) {
    const tenant = tenants[tIndex]
    const tenantMerchants = merchants.filter((m) => m.tenantId === tenant.id)
    const washPoint = tenantMerchants[0]
    const branchTemplates: Array<{ name: string; merchantCode: string }> = []
    for (const merchant of tenantMerchants) {
      for (let bIndex = 0; bIndex < merchant.plannedBranches; bIndex += 1) {
        let branchName = pick(BRANCH_NAME_POOL)
        if (tenant.code === "Company-A" && merchant.id === tenantMerchants[0]?.id && bIndex === 0) branchName = "Skyview"
        if (tenant.code === "Company-A" && merchant.id === tenantMerchants[0]?.id && bIndex === 1) branchName = "RGH18"
        branchTemplates.push({
          name: branchName,
          merchantCode: merchant.code,
        })
      }
    }

    for (let i = 0; i < branchTemplates.length; i += 1) {
      const tpl = branchTemplates[i]!
      const merchant = tenantMerchants.find((m) => m.code === tpl.merchantCode) || washPoint || tenantMerchants[0]
      if (!merchant) continue

      const branch = await prisma.branch.create({
        data: {
          tenantId: tenant.id,
          merchantAccountId: merchant.id,
          code: `BR-${String(branchSeq).padStart(4, "0")}`,
          name: tpl.name,
          status: Math.random() < 0.9 ? "ACTIVE" : "INACTIVE",
        },
      })
      branchSeq += 1
      branches.push(branch)

      const tenantBillers = billerProfiles.filter((b) => b.tenantId === tenant.id)
      const targetBiller = tenantBillers[i % Math.max(tenantBillers.length, 1)]
      if (targetBiller) {
        await prisma.branchBillerBinding.create({
          data: {
            tenantId: tenant.id,
            branchId: branch.id,
            billerProfileId: targetBiller.id,
            isDefault: true,
            active: true,
            priority: 100,
          },
        })
      }
    }
  }

  const assets = []
  const machineRefs: Array<{ id: string; assetId: string; tenantId: string; merchantAccountId: string | null; branchId: string }> = []
  let wmSeq = 1
  let dmSeq = 1
  let machineSeq = 1
  let assetSeq = 0

  for (const branch of branches) {
    for (let i = 0; i < 5; i += 1) {
      const kind = Math.random() < 0.65 ? "WASHER" : "DRYER"
      const assetName =
        kind === "WASHER"
          ? `WM-${String(wmSeq).padStart(3, "0")}`
          : `DM-${String(dmSeq).padStart(3, "0")}`
      if (kind === "WASHER") wmSeq += 1
      else dmSeq += 1

      const asset = await prisma.asset.create({
        data: {
          tenantId: branch.tenantId,
          branchId: branch.id,
          assetUuid: toAssetUuid(assetSeq),
          code: `AS-${String(assetSeq + 1).padStart(4, "0")}`,
          name: assetName,
          kind,
          status: Math.random() < 0.82 ? "ACTIVE" : Math.random() < 0.5 ? "INACTIVE" : "MAINTENANCE",
        },
      })
      assetSeq += 1
      assets.push(asset)

      const displayType = pick(MACHINE_DISPLAY_TYPES)
      const machineKind =
        displayType === "Dryer" ? "DRYER" :
        displayType === "Water" ? "WATER" :
        displayType === "Vending" ? "VENDING" :
        "WASHER"
      const machineStatusRoll = Math.random()
      const machineStatus =
        machineStatusRoll < 0.68 ? "AVAILABLE" :
        machineStatusRoll < 0.82 ? "RUNNING" :
        machineStatusRoll < 0.94 ? "MAINTENANCE" :
        "RESERVED"

      const machine = await prisma.machine.create({
        data: {
          tenantId: branch.tenantId,
          merchantAccountId: branch.merchantAccountId,
          branchId: branch.id,
          assetId: asset.id,
          code: `SN-${String(machineSeq).padStart(8, "0")}`,
          name: `${displayType}-${String(machineSeq).padStart(4, "0")}`,
          kind: machineKind,
          status: machineStatus,
          locationLabel: branch.name,
          topic: `iot/${branch.code}/${asset.code}`,
          remainingMinutes: machineStatus === "RUNNING" ? 10 + Math.floor(Math.random() * 80) : null,
        },
      })
      machineSeq += 1
      machineRefs.push({
        id: machine.id,
        assetId: asset.id,
        tenantId: branch.tenantId,
        merchantAccountId: branch.merchantAccountId ?? null,
        branchId: branch.id,
      })

      const amount =
        machineKind === "DRYER"
          ? pick(DRY_PRICES)
          : pick(WASH_PRICES)
      await prisma.machinePrice.create({
        data: {
          machineId: machine.id,
          label: machineKind === "DRYER" ? "Dry Program" : `${displayType} Program`,
          amount,
          durationMinutes: machineKind === "DRYER" ? 40 + Math.floor(Math.random() * 26) : 35 + Math.floor(Math.random() * 31),
          sortOrder: 1,
        },
      })
    }
  }

  const devices = []
  for (let i = 0; i < 180; i += 1) {
    const ref = i < assets.length ? assets[i] : null
    const device = await prisma.iotDevice.create({
      data: {
        tenantId: ref?.tenantId || tenants[i % tenants.length]!.id,
        macAddress: toMac(i),
        deviceUid: `DEV-${String(i + 1).padStart(5, "0")}`,
        fwVersion: `v1.${Math.floor(i / 30)}.${(i % 10) + 1}`,
        metadata: i < 120
          ? { mode: "ONLINE", stock: "ACTIVE" }
          : i < 150
            ? { mode: "OFFLINE", stock: "ACTIVE" }
            : { mode: "OFFLINE", stock: "SPARE" },
      },
    })
    devices.push(device)
  }

  for (let i = 0; i < assets.length; i += 1) {
    const asset = assets[i]
    const device = devices[i]
    if (!asset || !device) continue

    await prisma.assetBinding.create({
      data: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        iotDeviceId: device.id,
        status: i < 135 ? "ACTIVE" : "INACTIVE",
        startedAt: new Date(Date.now() - (i + 1) * 86400000),
        endedAt: i < 135 ? null : new Date(Date.now() - (i % 20) * 86400000),
        reason: i < 135 ? null : "offline-or-spare",
        metadata: i < 135 ? { note: "bound" } : { note: "retired binding" },
      },
    })
  }

  const machinePriceMap = new Map<string, { id: string; amount: number; label: string; durationMinutes: number }>()
  const prices = await prisma.machinePrice.findMany({
    select: {
      id: true,
      machineId: true,
      amount: true,
      label: true,
      durationMinutes: true,
    },
  })
  for (const p of prices) {
    machinePriceMap.set(p.machineId, p)
  }

  let orderSeq = 1
  for (const m of machineRefs) {
    const price = machinePriceMap.get(m.id)
    if (!price) continue

    const orderRoll = Math.random()
    const orderCountForMachine =
      orderRoll < 0.16 ? 0 :
      orderRoll < 0.38 ? 1 :
      orderRoll < 0.60 ? 2 :
      orderRoll < 0.76 ? 3 :
      orderRoll < 0.88 ? 4 :
      orderRoll < 0.95 ? 6 :
      8

    for (let k = 0; k < orderCountForMachine; k += 1) {
      const statusRoll = Math.random()
      const orderStatus =
        statusRoll < 0.6 ? "COMPLETED" :
        statusRoll < 0.75 ? "IN_PROGRESS" :
        statusRoll < 0.88 ? "CONFIRMED" :
        statusRoll < 0.96 ? "PENDING_PAYMENT" :
        "CANCELLED"
      const itemStatus =
        orderStatus === "COMPLETED" ? "COMPLETED" :
        orderStatus === "IN_PROGRESS" ? "RUNNING" :
        orderStatus === "CANCELLED" ? "FAILED" :
        "PENDING"

      await prisma.order.create({
        data: {
          tenantId: m.tenantId,
          merchantAccountId: m.merchantAccountId,
          branchId: m.branchId,
          orderNumber: `ORD-MOCK-${String(orderSeq).padStart(6, "0")}`,
          customerName: `Customer ${String(orderSeq).padStart(4, "0")}`,
          lineUserId: `U${String(orderSeq).padStart(10, "0")}`,
          note: "mock-seed",
          totalAmount: price.amount,
          status: orderStatus,
          createdAt: new Date(Date.now() - (orderSeq % 60) * 3600000),
          items: {
            create: [
              {
                machineId: m.id,
                assetId: m.assetId,
                priceId: price.id,
                priceLabel: price.label,
                amount: price.amount,
                durationMinutes: price.durationMinutes,
                status: itemStatus,
                startedAt: itemStatus === "RUNNING" || itemStatus === "COMPLETED" ? new Date(Date.now() - 1800000) : null,
                completedAt: itemStatus === "COMPLETED" ? new Date(Date.now() - 300000) : null,
              },
            ],
          },
          payment: {
            create: {
              tenantId: m.tenantId,
              merchantAccountId: m.merchantAccountId,
              branchId: m.branchId,
              amount: price.amount,
              qrPayload: `MOCK-QR-${orderSeq}`,
              status:
                orderStatus === "COMPLETED" || orderStatus === "IN_PROGRESS" || orderStatus === "CONFIRMED"
                  ? "VERIFIED"
                  : "PENDING",
              verifiedAt:
                orderStatus === "COMPLETED" || orderStatus === "IN_PROGRESS" || orderStatus === "CONFIRMED"
                  ? new Date()
                  : null,
            },
          },
        },
      })
      orderSeq += 1
    }
  }

  console.log("Seed completed")
  console.log(`Tenants: ${tenants.length}`)
  console.log(`Merchants: ${merchants.length}`)
  console.log(`Branches: ${branches.length}`)
  console.log(`Assets: ${assets.length}`)
  console.log(`Devices: ${devices.length}`)
  console.log(`Orders: ${orderSeq - 1}`)
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
