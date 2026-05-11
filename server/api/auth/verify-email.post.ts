import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { verifyEmailVerificationToken } from "../../utils/email-verification";

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const body = verifyEmailSchema.parse(await readBody(event));
  const config = useRuntimeConfig();
  const authSecret = config.authSecret || "dev-auth-secret-change-me";

  const { email } = verifyEmailVerificationToken({
    token: body.token,
    secret: authSecret,
  });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true, emailVerified: true },
  });

  if (!user || !user.isActive) {
    throw createError({
      statusCode: 404,
      statusMessage: "No active account found for this token",
    });
  }

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
      },
    });
  }

  return {
    ok: true,
    message: "Email verified successfully",
  };
});
