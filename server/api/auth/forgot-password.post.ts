import { z } from "zod";
import { Resend } from "resend";
import { prisma } from "../../utils/prisma";
import { createPasswordResetToken } from "../../utils/password-reset";
import { resolvePasswordResetExpiryMinutes } from "../../utils/system-config";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export default defineEventHandler(async (event) => {
  const body = forgotPasswordSchema.parse(await readBody(event));
  const email = body.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true, name: true },
  });

  if (!user || !user.isActive) {
    throw createError({
      statusCode: 404,
      statusMessage: "No active account found for this email",
    });
  }

  const config = useRuntimeConfig();
  const authSecret = config.authSecret || "dev-auth-secret-change-me";
  const expiresInMinutes = await resolvePasswordResetExpiryMinutes(event);
  const token = createPasswordResetToken({
    email,
    secret: authSecret,
    expiresInMinutes,
  });

  const authOrigin = String(config.authOrigin || "").trim();
  const authOriginBase = authOrigin.replace(/\/api\/auth\/?$/i, "");
  const baseUrl =
    authOriginBase ||
    config.public.appUrl ||
    `${getRequestProtocol(event)}://${getRequestHost(event)}`;
  const resetUrl = `${baseUrl.replace(/\/$/, "")}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const from = config.authMagicLinkFrom || "Washpoint <onboarding@resend.dev>";
  if (process.dev) {
    console.info("[auth][forgot-password] reset recipient:", email);
    console.info("[auth][forgot-password] reset url:", resetUrl);
  }

  if (config.resendApiKey) {
    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({
      from,
      to: email,
      subject: "Reset your Washpoint password",
      html: `
        <p>Hi ${user.name || "there"},</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in ${expiresInMinutes} minutes.</p>
      `,
    });
  }

  return {
    ok: true,
    message: "Password reset link has been sent",
  };
});
