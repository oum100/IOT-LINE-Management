import { z } from "zod";
import { prisma } from "../../../../utils/prisma";
import { assertAdminAccess } from "../../../../utils/admin-auth";

const schema = z.object({
  providerCode: z.string().trim().min(2).max(40),
  billerId: z.string().trim().min(2).max(80),
  routeCode: z.string().trim().min(2).max(80),
  paymentMethodType: z.string().trim().min(2).max(40).default("PROMPTPAY_QR"),
  isDefault: z.boolean().default(false),
  note: z.string().trim().max(300).optional(),
});

type TenantMetadata = Record<string, any> & {
  paymentRouting?: {
    routes?: Array<{
      providerCode: string;
      billerId: string;
      routeCode: string;
      paymentMethodType: string;
      isDefault: boolean;
      note?: string;
      updatedAt: string;
    }>;
  };
};

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing tenant id" });

  const body = schema.parse(await readBody(event));

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, metadata: true },
  });

  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: "Tenant not found" });
  }

  const metadata: TenantMetadata = ((tenant.metadata as any) || {}) as TenantMetadata;
  const existingRoutes = Array.isArray(metadata.paymentRouting?.routes)
    ? [...(metadata.paymentRouting?.routes || [])]
    : [];

  const nextRoute = {
    providerCode: body.providerCode,
    billerId: body.billerId,
    routeCode: body.routeCode,
    paymentMethodType: body.paymentMethodType,
    isDefault: body.isDefault,
    note: body.note || undefined,
    updatedAt: new Date().toISOString(),
  };

  let routes = existingRoutes.filter((item) => item.routeCode !== body.routeCode);
  if (body.isDefault) {
    routes = routes.map((item) => ({ ...item, isDefault: false }));
  }
  routes.unshift(nextRoute);

  const updatedMetadata: TenantMetadata = {
    ...metadata,
    paymentRouting: {
      ...(metadata.paymentRouting || {}),
      routes,
    },
  };

  await prisma.tenant.update({
    where: { id },
    data: {
      metadata: updatedMetadata as any,
    },
  });

  return {
    ok: true,
    routes,
  };
});
