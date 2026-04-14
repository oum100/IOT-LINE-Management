import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AssetStatus,
  DeviceBindingStatus,
  EnvironmentMode,
  MachineKind,
  MachineStatus,
  MerchantStatus,
  PrismaClient,
  TenantStatus,
} from "@prisma/client";

type ApiSku = {
  sku_name?: string | null;
  sku_price?: string | number | null;
  sku_period?: string | number | null;
};

type ApiRow = {
  device_id: number;
  device_merchantid?: number | null;
  device_merchantname?: string | null;
  device_mac?: string | null;
  device_serial?: string | null;
  device_udid?: string | null;
  device_type?: number | null;
  device_macinename?: string | null;
  machine_status?: string | null;
  machine_sku?: ApiSku[] | null;
};

type ApiPayload = {
  StatusCode?: string;
  ResultValues?: ApiRow[];
};

type MongoDevice = {
  merchantCode?: string;
  branchCode?: string;
  deviceName?: string;
  uuid?: string;
  macAddr?: string;
  type?: string;
  status?: string;
};

type MongoBranch = {
  branchCode?: string;
  branchName?: string;
};

const prisma = new PrismaClient();

const apiJsonPath = process.env.PAYBOARD_API_JSON || process.argv[2] || "/private/tmp/payboard_devices_111.json";
const mongoJsonPath = process.env.PAYBOARD_MONGO_JSON || process.argv[3] || "/private/tmp/payboard_mongo_devices.json";
const mongoBranchPath = process.env.PAYBOARD_MONGO_BRANCH_JSON || process.argv[4] || "/private/tmp/payboard_mongo_branches.json";

const tenantCode = process.env.PAYBOARD_TENANT_CODE || "washpoint";
const tenantName = process.env.PAYBOARD_TENANT_NAME || "Washpoint";
const merchantCode = process.env.PAYBOARD_MERCHANT_CODE || "1000105";
const merchantName = process.env.PAYBOARD_MERCHANT_NAME || "Washpoint";

function normalizeMac(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function toMachineKind(typeFromMongo?: string, deviceTypeFromApi?: number | null) {
  const type = String(typeFromMongo || "").toLowerCase();
  if (type.includes("dryer") || deviceTypeFromApi === 2) return MachineKind.DRYER;
  return MachineKind.WASHER;
}

function statusFromMongo(value?: string) {
  const v = String(value || "").toLowerCase();
  return v === "active" ? MachineStatus.AVAILABLE : MachineStatus.MAINTENANCE;
}

function parseIntSafe(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function readJson<T>(path: string) {
  const content = readFileSync(resolve(path), "utf8");
  return JSON.parse(content) as T;
}

async function main() {
  const apiPayload = readJson<ApiPayload>(apiJsonPath);
  const mongoDevices = readJson<MongoDevice[]>(mongoJsonPath);
  const mongoBranches = readJson<MongoBranch[]>(mongoBranchPath);

  const apiRows = apiPayload.ResultValues || [];
  const apiByUuid = new Map(
    apiRows
      .filter((row) => row.device_udid)
      .map((row) => [String(row.device_udid), row]),
  );
  const mongoByUuid = new Map(
    mongoDevices
      .filter((row) => row.uuid)
      .map((row) => [String(row.uuid), row]),
  );

  const commonUuids = [...mongoByUuid.keys()].filter((uuid) => apiByUuid.has(uuid));
  if (!commonUuids.length) {
    throw new Error("No matching UUID between MongoDB and API JSON");
  }

  const branchNameByCode = new Map(
    mongoBranches
      .filter((branch) => branch.branchCode)
      .map((branch) => [String(branch.branchCode), String(branch.branchName || `Branch ${branch.branchCode}`)]),
  );

  const tenant = await prisma.tenant.upsert({
    where: { code: tenantCode },
    create: {
      code: tenantCode,
      name: tenantName,
      status: TenantStatus.ACTIVE,
    },
    update: {
      name: tenantName,
      status: TenantStatus.ACTIVE,
    },
  });

  const merchant = await prisma.merchantAccount.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: merchantCode,
      },
    },
    create: {
      tenantId: tenant.id,
      code: merchantCode,
      name: merchantName,
      status: MerchantStatus.ACTIVE,
      environment: EnvironmentMode.TEST,
      metadata: {
        source: "mongo+payboard-sync",
      },
    },
    update: {
      name: merchantName,
      status: MerchantStatus.ACTIVE,
      environment: EnvironmentMode.TEST,
      metadata: {
        source: "mongo+payboard-sync",
      },
    },
  });

  const branchByCode = new Map<string, { id: string; code: string; name: string }>();

  for (const uuid of commonUuids) {
    const mongo = mongoByUuid.get(uuid)!;
    const code = String(mongo.branchCode || "main");
    if (branchByCode.has(code)) continue;

    const name = branchNameByCode.get(code) || `Branch ${code}`;
    const branch = await prisma.branch.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code,
        },
      },
      create: {
        tenantId: tenant.id,
        merchantAccountId: merchant.id,
        code,
        name,
      },
      update: {
        merchantAccountId: merchant.id,
        name,
      },
    });

    branchByCode.set(code, { id: branch.id, code: branch.code, name: branch.name });
  }

  const syncedMachineCodes = new Set<string>();
  let syncedCount = 0;

  for (const uuid of commonUuids) {
    const mongo = mongoByUuid.get(uuid)!;
    const api = apiByUuid.get(uuid)!;

    const machineCode = `PB-${api.device_id}`;
    const machineName = String(mongo.deviceName || api.device_macinename || machineCode);
    const macFromApi = normalizeMac(api.device_mac);
    const serialNo = String(api.device_serial || `PB-SERIAL-${api.device_id}`);
    const branchCode = String(mongo.branchCode || "main");
    const branch = branchByCode.get(branchCode);
    if (!branch) continue;

    const kind = toMachineKind(mongo.type, api.device_type);

    const machineUnit = await prisma.machineUnit.upsert({
      where: { serialNo },
      create: {
        tenantId: tenant.id,
        serialNo,
        metadata: { source: "payboard-api", uuid },
      },
      update: {
        tenantId: tenant.id,
      },
    });

    const iotDevice = await prisma.iotDevice.upsert({
      where: { macAddress: macFromApi || `PB-MAC-${api.device_id}` },
      create: {
        tenantId: tenant.id,
        macAddress: macFromApi || `PB-MAC-${api.device_id}`,
        deviceUid: uuid,
        metadata: {
          source: "payboard-api",
          apiDeviceId: api.device_id,
        },
      },
      update: {
        tenantId: tenant.id,
        deviceUid: uuid,
      },
    });

    const asset = await prisma.asset.upsert({
      where: { assetUuid: uuid },
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        assetUuid: uuid,
        code: machineCode,
        name: machineName,
        kind,
        status: AssetStatus.ACTIVE,
        metadata: {
          source: "mongo+api",
          merchantCode,
          branchCode,
          apiDeviceId: api.device_id,
          apiMerchantId: api.device_merchantid,
          apiMac: macFromApi,
          mongoMac: normalizeMac(mongo.macAddr),
        },
      },
      update: {
        tenantId: tenant.id,
        branchId: branch.id,
        code: machineCode,
        name: machineName,
        kind,
        status: AssetStatus.ACTIVE,
        metadata: {
          source: "mongo+api",
          merchantCode,
          branchCode,
          apiDeviceId: api.device_id,
          apiMerchantId: api.device_merchantid,
          apiMac: macFromApi,
          mongoMac: normalizeMac(mongo.macAddr),
        },
      },
    });

    const activeBinding = await prisma.assetBinding.findFirst({
      where: {
        tenantId: tenant.id,
        assetId: asset.id,
        status: DeviceBindingStatus.ACTIVE,
        endedAt: null,
      },
      orderBy: { startedAt: "desc" },
    });

    if (!activeBinding) {
      await prisma.assetBinding.create({
        data: {
          tenantId: tenant.id,
          assetId: asset.id,
          machineUnitId: machineUnit.id,
          iotDeviceId: iotDevice.id,
          status: DeviceBindingStatus.ACTIVE,
          reason: "sync-from-mongo-api",
        },
      });
    } else if (activeBinding.machineUnitId !== machineUnit.id || activeBinding.iotDeviceId !== iotDevice.id) {
      await prisma.assetBinding.update({
        where: { id: activeBinding.id },
        data: {
          status: DeviceBindingStatus.INACTIVE,
          endedAt: new Date(),
          reason: "rebound-by-sync",
        },
      });
      await prisma.assetBinding.create({
        data: {
          tenantId: tenant.id,
          assetId: asset.id,
          machineUnitId: machineUnit.id,
          iotDeviceId: iotDevice.id,
          status: DeviceBindingStatus.ACTIVE,
          reason: "sync-from-mongo-api",
        },
      });
    }

    const machine = await prisma.machine.upsert({
      where: { code: machineCode },
      create: {
        tenantId: tenant.id,
        merchantAccountId: merchant.id,
        branchId: branch.id,
        assetId: asset.id,
        code: machineCode,
        name: machineName,
        kind,
        status: statusFromMongo(mongo.status),
        locationLabel: branch.name,
        topic: `payboard/${uuid}`,
      },
      update: {
        tenantId: tenant.id,
        merchantAccountId: merchant.id,
        branchId: branch.id,
        assetId: asset.id,
        name: machineName,
        kind,
        status: statusFromMongo(mongo.status),
        locationLabel: branch.name,
        topic: `payboard/${uuid}`,
      },
    });

    await prisma.machinePrice.deleteMany({
      where: { machineId: machine.id },
    });

    const prices = (api.machine_sku || []).map((sku, idx) => ({
      machineId: machine.id,
      label: String(sku.sku_name || `Plan ${idx + 1}`).replace(/^#+/, "").trim() || `Plan ${idx + 1}`,
      amount: parseIntSafe(sku.sku_price),
      durationMinutes: parseIntSafe(sku.sku_period),
      sortOrder: idx + 1,
    }));

    if (prices.length) {
      await prisma.machinePrice.createMany({ data: prices });
    }

    for (const price of prices) {
      const productCode = `${kind}-${price.durationMinutes}M-${price.amount}`;
      const product = await prisma.product.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: productCode,
          },
        },
        create: {
          tenantId: tenant.id,
          code: productCode,
          name: `${kind === MachineKind.WASHER ? "Washer" : "Dryer"} ${price.durationMinutes} นาที`,
          kind,
          active: true,
        },
        update: {
          name: `${kind === MachineKind.WASHER ? "Washer" : "Dryer"} ${price.durationMinutes} นาที`,
          active: true,
        },
      });

      await prisma.assetProductPrice.upsert({
        where: {
          assetId_productId: {
            assetId: asset.id,
            productId: product.id,
          },
        },
        create: {
          tenantId: tenant.id,
          assetId: asset.id,
          productId: product.id,
          amount: price.amount,
          durationMinutes: price.durationMinutes,
          sortOrder: price.sortOrder,
          active: true,
        },
        update: {
          amount: price.amount,
          durationMinutes: price.durationMinutes,
          sortOrder: price.sortOrder,
          active: true,
        },
      });
    }

    syncedMachineCodes.add(machineCode);
    syncedCount += 1;
  }

  const staleMachines = await prisma.machine.findMany({
    where: {
      tenantId: tenant.id,
      merchantAccountId: merchant.id,
      code: {
        startsWith: "PB-",
      },
      NOT: {
        code: {
          in: [...syncedMachineCodes],
        },
      },
      orderItems: {
        none: {},
      },
    },
    select: {
      id: true,
      assetId: true,
      code: true,
    },
  });

  for (const stale of staleMachines) {
    await prisma.machinePrice.deleteMany({ where: { machineId: stale.id } });
    await prisma.machine.delete({ where: { id: stale.id } });

    if (stale.assetId) {
      await prisma.assetProductPrice.deleteMany({ where: { assetId: stale.assetId } });
      await prisma.assetBinding.updateMany({
        where: { assetId: stale.assetId, endedAt: null },
        data: {
          endedAt: new Date(),
          status: DeviceBindingStatus.INACTIVE,
          reason: "stale-after-sync",
        },
      });
      await prisma.asset.deleteMany({ where: { id: stale.assetId } });
    }
  }

  console.log(
    JSON.stringify(
      {
        tenantCode,
        merchantCode,
        commonUuidCount: commonUuids.length,
        syncedCount,
        branchCodes: [...branchByCode.keys()].sort(),
        staleDeleted: staleMachines.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
