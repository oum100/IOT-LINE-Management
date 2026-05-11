import { z } from "zod";
import { hashPassword } from "../../utils/password";
import { prisma } from "../../utils/prisma";
import { verifyPasswordResetToken } from "../../utils/password-reset";

const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Password confirmation does not match",
  })
  .refine((data) => /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(data.password), {
    path: ["password"],
    message: "Password must be at least 8 chars, 1 uppercase, 1 number, 1 special",
  });

export default defineEventHandler(async (event) => {
  const body = resetPasswordSchema.parse(await readBody(event));
  const config = useRuntimeConfig();
  const authSecret = config.authSecret || "dev-auth-secret-change-me";

  const { email } = verifyPasswordResetToken({
    token: body.token,
    secret: authSecret,
  });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw createError({
      statusCode: 404,
      statusMessage: "No active account found for this token",
    });
  }

  const passwordHash = await hashPassword(body.password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      updatedAt: new Date(),
    },
  });

  await prisma.session.deleteMany({
    where: { userId: user.id },
  });

  return {
    ok: true,
    message: "Password updated successfully",
  };
});
