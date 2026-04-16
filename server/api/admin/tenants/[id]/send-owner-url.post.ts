import { z } from "zod";
import { Resend } from "resend";
import { prisma } from "../../../../utils/prisma";
import { assertAdminAccess } from "../../../../utils/admin-auth";

const schema = z.object({
  ownerUserId: z.string().trim().optional(),
  ownerEmail: z.string().email().optional(),
  ownerName: z.string().trim().max(120).optional(),
  ownerUrl: z.string().url().optional(),
});

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing tenant id" });

  const body = schema.parse(await readBody(event));
  const config = useRuntimeConfig(event);

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, metadata: true },
  });
  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: "Tenant not found" });
  }

  let ownerEmail = body.ownerEmail?.toLowerCase().trim() || "";
  let ownerName = body.ownerName?.trim() || "";

  if (body.ownerUserId) {
    const ownerUser = await prisma.user.findUnique({
      where: { id: body.ownerUserId },
      select: { id: true, email: true, name: true },
    });
    if (!ownerUser) {
      throw createError({ statusCode: 404, statusMessage: "Owner user not found" });
    }
    ownerEmail = ownerUser.email.toLowerCase();
    ownerName = ownerName || ownerUser.name || "";
  }

  if (!ownerEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: "ownerEmail or ownerUserId is required",
    });
  }

  const appBaseUrl = String(config.public.appUrl || "").replace(/\/$/, "");
  const ownerUrl =
    body.ownerUrl ||
    `${appBaseUrl}/login?callback=${encodeURIComponent(`/app/dashboard?tenant=${tenant.code}`)}`;

  const from = config.authMagicLinkFrom || "Washpoint <onboarding@resend.dev>";
  let delivered = false;

  if (config.resendApiKey) {
    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({
      from,
      to: ownerEmail,
      subject: `Tenant owner access: ${tenant.name}`,
      html: `
        <p>Hi ${ownerName || "Owner"},</p>
        <p>Your tenant access URL is ready for <strong>${tenant.name}</strong>.</p>
        <p><a href="${ownerUrl}">${ownerUrl}</a></p>
      `,
    });
    delivered = true;
  } else {
    console.info("[admin][tenant] owner recipient:", ownerEmail);
    console.info("[admin][tenant] owner url:", ownerUrl);
  }

  const metadata = (tenant.metadata as Record<string, any> | null) || {};
  await prisma.tenant.update({
    where: { id },
    data: {
      metadata: {
        ...metadata,
        ownerContact: {
          userId: body.ownerUserId || null,
          email: ownerEmail,
          name: ownerName || null,
          sentAt: new Date().toISOString(),
        },
      } as any,
    },
  });

  return {
    ok: true,
    delivered,
    ownerEmail,
    ownerUrl,
  };
});
