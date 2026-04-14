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

type PayboardSku = {
  sku_name?: string | null;
  sku_price?: string | number | null;
  sku_period?: string | number | null;
};

type PayboardDevice = {
  device_id: number;
  device_merchantid?: number | null;
  device_merchantname?: string | null;
  device_mac?: string | null;
  device_serial?: string | null;
  device_udid?: string | null;
  machine_status?: string | null;
  machine_status_int?: number | null;
  device_type?: number | null;
  device_typename?: string | null;
  machine_id?: number | null;
  device_macinename?: string | null;
  device_lastupdate?: string | null;
  checkDelete?: boolean | null;
  machine_sku?: PayboardSku[] | null;
};

type PayboardPayload = {
  StatusCode?: string;
  ResultValues?: PayboardDevice[];
};

const prisma = new PrismaClient();

const inputPath = process.argv[2] || process.env.PAYBOARD_DEVICES_JSON || "/private/tmp/payboard_devices_111.json";
const tenantCode = process.env.PAYBOARD_TENANT_CODE || "washpoint";
const tenantName = process.env.PAYBOARD_TENANT_NAME || "Washpoint";
const includeDeleted = process.env.PAYBOARD_INCLUDE_DELETED === "1";

function toCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseAmount(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function parseDuration(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function machineKindFrom(device: PayboardDevice) {
  return device.device_type === 2 ? MachineKind.DRYER : MachineKind.WASHER;
}

function machineStatusFrom(device: PayboardDevice) {
  const status = String(device.machine_status ?? "").toLowerCase();
  if (status === "offline") return MachineStatus.MAINTENANCE;
  return MachineStatus.AVAILABLE;
}

async function main() {
  const filePath = resolve(inputPath);
  const payload = JSON.parse(readFileSync(filePath, "utf8")) as PayboardPayload;
  const allRows = payload.ResultValues ?? [];
  const rows = includeDeleted ? allRows : allRows.filter((row) => !row.checkDelete);

  if (!rows.length) {
    throw new Error(`No device rows found in ${filePath}`);
  }

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

  const merchantById = new Map<number, { id: string; code: string; name: string; branchId: string }>();

  for (const row of rows) {
    const merchantNumericId = Number(row.device_merchantid ?? 0);
    if (!merchantNumericId || merchantById.has(merchantNumericId)) continue;

    const merchantName = (row.device_merchantname || `Merchant ${merchantNumericId}`).trim();
    const merchantCode = `${toCode(merchantName)}-${merchantNumericId}`;
    const branchCode = `${merchantCode}-main`;

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
          payboardMerchantId: merchantNumericId,
        },
      },
      update: {
        name: merchantName,
        status: MerchantStatus.ACTIVE,
        metadata: {
          payboardMerchantId: merchantNumericId,
        },
      },
    });

    const branch = await prisma.branch.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: branchCode,
        },
      },
      create: {
        tenantId: tenant.id,
        merchantAccountId: merchant.id,
        code: branchCode,
        name: `${merchantName} Main`,
      },
      update: {
        merchantAccountId: merchant.id,
        name: `${merchantName} Main`,
      },
    });

    merchantById.set(merchantNumericId, {
      id: merchant.id,
      code: merchant.code,
      name: merchant.name,
      branchId: branch.id,
    });
  }

  let assetCount = 0;
  let machineCount = 0;
  let machinePriceCount = 0;

  for (const row of rows) {
    const merchantNumericId = Number(row.device_merchantid ?? 0);
    const merchantInfo = merchantById.get(merchantNumericId);
    if (!merchantInfo) continue;

    const kind = machineKindFrom(row);
    const assetUuid = (row.device_udid || `PB-UUID-${row.device_id}`).trim();
    const machineName = (row.device_macinename || `Machine ${row.device_id}`).trim();
    const machineCode = `PB-${row.device_id}`;

    const asset = await prisma.asset.upsert({
      where: { assetUuid },
      create: {
        tenantId: tenant.id,
        branchId: merchantInfo.branchId,
        assetUuid,
        code: machineCode,
        name: machineName,
        kind,
        status: AssetStatus.ACTIVE,
        metadata: {
          source: "payboard",
          payboardDeviceId: row.device_id,
          payboardMachineId: row.machine_id,
          payboardMerchantId: merchantNumericId,
          rawTypeName: row.device_typename,
        },
      },
      update: {
        tenantId: tenant.id,
        branchId: merchantInfo.branchId,
        code: machineCode,
        name: machineName,
        kind,
        status: AssetStatus.ACTIVE,
        metadata: {
          source: "payboard",
          payboardDeviceId: row.device_id,
          payboardMachineId: row.machine_id,
          payboardMerchantId: merchantNumericId,
          rawTypeName: row.device_typename,
        },
      },
    });
    assetCount += 1;

    const machineUnit = await prisma.machineUnit.upsert({
      where: {
        serialNo: (row.device_serial || `PB-SERIAL-${row.device_id}`).trim(),
      },
      create: {
        tenantId: tenant.id,
        serialNo: (row.device_serial || `PB-SERIAL-${row.device_id}`).trim(),
        metadata: {
          source: "payboard",
          payboardDeviceId: row.device_id,
        },
      },
      update: {
        tenantId: tenant.id,
      },
    });

    const iot = await prisma.iotDevice.upsert({
      where: {
        macAddress: (row.device_mac || `PB-MAC-${row.device_id}`).trim().toUpperCase(),
      },
      create: {
        tenantId: tenant.id,
        macAddress: (row.device_mac || `PB-MAC-${row.device_id}`).trim().toUpperCase(),
        deviceUid: row.device_udid || null,
        metadata: {
          source: "payboard",
          payboardDeviceId: row.device_id,
        },
      },
      update: {
        tenantId: tenant.id,
        deviceUid: row.device_udid || undefined,
      },
    });

    const activeBinding = await prisma.assetBinding.findFirst({
      where: {
        tenantId: tenant.id,
        assetId: asset.id,
        status: DeviceBindingStatus.ACTIVE,
        endedAt: null,
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    if (!activeBinding) {
      await prisma.assetBinding.create({
        data: {
          tenantId: tenant.id,
          assetId: asset.id,
          machineUnitId: machineUnit.id,
          iotDeviceId: iot.id,
          status: DeviceBindingStatus.ACTIVE,
          reason: "initial-import",
        },
      });
    } else if (activeBinding.machineUnitId !== machineUnit.id || activeBinding.iotDeviceId !== iot.id) {
      await prisma.assetBinding.update({
        where: { id: activeBinding.id },
        data: {
          status: DeviceBindingStatus.INACTIVE,
          endedAt: new Date(),
          reason: "replaced-by-import",
        },
      });
      await prisma.assetBinding.create({
        data: {
          tenantId: tenant.id,
          assetId: asset.id,
          machineUnitId: machineUnit.id,
          iotDeviceId: iot.id,
          status: DeviceBindingStatus.ACTIVE,
          reason: "sync-import",
        },
      });
    }

    const machine = await prisma.machine.upsert({
      where: { code: machineCode },
      create: {
        tenantId: tenant.id,
        merchantAccountId: merchantInfo.id,
        branchId: merchantInfo.branchId,
        assetId: asset.id,
        code: machineCode,
        name: machineName,
        kind,
        status: machineStatusFrom(row),
        locationLabel: merchantInfo.name,
        topic: row.device_udid ? `payboard/${row.device_udid}` : null,
        remainingMinutes: null,
      },
      update: {
        tenantId: tenant.id,
        merchantAccountId: merchantInfo.id,
        branchId: merchantInfo.branchId,
        assetId: asset.id,
        name: machineName,
        kind,
        status: machineStatusFrom(row),
        locationLabel: merchantInfo.name,
        topic: row.device_udid ? `payboard/${row.device_udid}` : null,
      },
    });
    machineCount += 1;

    const skus = (row.machine_sku || []).filter(Boolean);
    for (let index = 0; index < skus.length; index += 1) {
      const sku = skus[index];
      const amount = parseAmount(sku.sku_price);
      const durationMinutes = parseDuration(sku.sku_period);
      const label = String(sku.sku_name || `Plan ${index + 1}`).replace(/^#+/, "").trim() || `Plan ${index + 1}`;

      const existingMachinePrice = await prisma.machinePrice.findFirst({
        where: {
          machineId: machine.id,
          label,
          amount,
          durationMinutes,
        },
      });

      if (!existingMachinePrice) {
        await prisma.machinePrice.create({
          data: {
            machineId: machine.id,
            label,
            amount,
            durationMinutes,
            sortOrder: index + 1,
          },
        });
        machinePriceCount += 1;
      }

      const productCode = `${kind}-${durationMinutes}M-${amount}`;
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
          name: `${kind === MachineKind.WASHER ? "Washer" : "Dryer"} ${durationMinutes} นาที`,
          kind,
          active: true,
        },
        update: {
          name: `${kind === MachineKind.WASHER ? "Washer" : "Dryer"} ${durationMinutes} นาที`,
          kind,
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
          amount,
          durationMinutes,
          sortOrder: index + 1,
          active: true,
        },
        update: {
          amount,
          durationMinutes,
          sortOrder: index + 1,
          active: true,
        },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        inputPath: filePath,
        tenant: { id: tenant.id, code: tenant.code },
        merchantsImported: merchantById.size,
        devicesImported: rows.length,
        assetsUpserted: assetCount,
        machinesUpserted: machineCount,
        machinePricesCreated: machinePriceCount,
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
