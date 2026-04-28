import { NuxtAuthHandler } from "#auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Resend } from "resend";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";

const require = createRequire(import.meta.url);
const CredentialsProvider = require("next-auth/providers/credentials")
  .default as typeof import("next-auth/providers/credentials").default;
const GoogleProvider = require("next-auth/providers/google")
  .default as typeof import("next-auth/providers/google").default;
const LineProvider = require("next-auth/providers/line")
  .default as typeof import("next-auth/providers/line").default;
const GithubProvider = require("next-auth/providers/github")
  .default as typeof import("next-auth/providers/github").default;

type Runtime = ReturnType<typeof useRuntimeConfig>;

function optionalGithubProvider(config: Runtime) {
  if (!config.githubClientId || !config.githubClientSecret) {
    return null;
  }
  return GithubProvider({
    clientId: config.githubClientId as string,
    clientSecret: config.githubClientSecret as string,
  });
}

function optionalGoogleProvider(config: Runtime) {
  if (!config.googleClientId || !config.googleClientSecret) {
    return null;
  }
  return GoogleProvider({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    authorization: {
      params: {
        prompt: "select_account",
      },
    },
  });
}

function optionalLineProvider(config: Runtime) {
  if (!config.lineLoginClientId || !config.lineLoginClientSecret) {
    return null;
  }
  return LineProvider({
    clientId: config.lineLoginClientId,
    clientSecret: config.lineLoginClientSecret,
    authorization: {
      params: {
        prompt: "consent",
      },
    },
    profile(profile: {
      sub?: string;
      userId?: string;
      name?: string;
      displayName?: string;
      picture?: string;
      pictureUrl?: string;
      email?: string;
    }) {
      const lineId = profile.sub || profile.userId || randomUUID();
      return {
        id: lineId,
        name: profile.name || profile.displayName || "LINE User",
        email: profile.email || `${lineId}@line.local`,
        image: profile.picture || profile.pictureUrl || null,
      };
    },
  });
}

function optionalMagicLinkProvider(config: Runtime) {
  if (!config.resendApiKey) {
    return null;
  }

  const EmailProvider = require("next-auth/providers/email")
    .default as typeof import("next-auth/providers/email").default;
  const resend = new Resend(config.resendApiKey);
  const from = config.authMagicLinkFrom || "Washpoint <onboarding@resend.dev>";
  return EmailProvider({
    from,
    async sendVerificationRequest({ identifier, url, provider }) {
      const email = identifier.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, isActive: true },
      });

      if (!existingUser || !existingUser.isActive) {
        throw new Error("No active account found for this email.");
      }

      if (process.dev) {
        console.info("[auth][magic-link] recipient:", identifier);
        console.info("[auth][magic-link] url:", url);
      }
      await resend.emails.send({
        from: provider.from || from,
        to: identifier,
        subject: "Sign in to Washpoint",
        html: `<p>คลิกลิงก์เพื่อเข้าสู่ระบบ:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  });
}

const runtimeConfig = useRuntimeConfig();
const authHandler = NuxtAuthHandler({
  secret: runtimeConfig.authSecret || "dev-auth-secret-change-me",
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user || !user.passwordHash || !user.isActive) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          tenantId: user.tenantId,
          merchantAccountId: user.merchantAccountId,
        };
      },
    }),
    ...([
      optionalGithubProvider(useRuntimeConfig()),
      optionalGoogleProvider(useRuntimeConfig()),
      optionalLineProvider(useRuntimeConfig()),
      optionalMagicLinkProvider(useRuntimeConfig()),
    ].filter(Boolean) as any[]),
  ] as any[],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (
        user?.id &&
        account?.provider &&
        (account.provider === "google" ||
          account.provider === "line" ||
          account.provider === "github")
      ) {
        const providerProfile = profile as {
          name?: string;
          displayName?: string;
          picture?: string;
          pictureUrl?: string;
          avatar_url?: string;
        } | null;

        const nextName =
          providerProfile?.name ||
          providerProfile?.displayName ||
          user.name ||
          null;
        const nextImage =
          providerProfile?.picture ||
          providerProfile?.pictureUrl ||
          providerProfile?.avatar_url ||
          user.image ||
          null;

        const data = {
          name: nextName,
          image: nextImage,
        };

        // OAuth callback can arrive before an exact `user.id` row is queryable in some flows.
        // Use updateMany to avoid hard-failing sign-in when profile-sync is best-effort.
        if (user.email) {
          await prisma.user.updateMany({
            where: { email: user.email.toLowerCase() },
            data,
          });
        } else {
          await prisma.user.updateMany({
            where: { id: user.id },
            data,
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        const appUser = user as typeof user & {
          role?: "ADMIN" | "USER";
          tenantId?: string | null;
          merchantAccountId?: string | null;
        };
        token.role = appUser.role || "USER";
        token.tenantId = appUser.tenantId || null;
        token.merchantAccountId = appUser.merchantAccountId || null;
      }

      if (token.sub) {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            tenantId: true,
            merchantAccountId: true,
            isActive: true,
          },
        });

        if (!freshUser || !freshUser.isActive) {
          token.role = "USER";
          token.tenantId = null;
          token.merchantAccountId = null;
        } else {
          token.role = freshUser.role || "USER";
          token.tenantId = freshUser.tenantId || null;
          token.merchantAccountId = freshUser.merchantAccountId || null;
        }
      }

      if (account?.provider) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: (token.sub as string | undefined) || session.user?.id,
        role: ((token.role as "ADMIN" | "USER" | undefined) || "USER") as
          | "ADMIN"
          | "USER",
        tenantId: (token.tenantId as string | null | undefined) || null,
        merchantAccountId:
          (token.merchantAccountId as string | null | undefined) || null,
        provider: (token.provider as string | undefined) || undefined,
      };
      return session;
    },
  },
});

export default authHandler;
