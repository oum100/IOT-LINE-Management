import { NuxtAuthHandler } from '#auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { createRequire } from 'node:module'
import { Resend } from 'resend'
import { prisma } from './prisma'
import { verifyPassword } from './password'

const require = createRequire(import.meta.url)
const CredentialsProvider = require('next-auth/providers/credentials').default as typeof import('next-auth/providers/credentials').default
const GoogleProvider = require('next-auth/providers/google').default as typeof import('next-auth/providers/google').default

type Runtime = ReturnType<typeof useRuntimeConfig>

function optionalGoogleProvider(config: Runtime) {
  if (!config.googleClientId || !config.googleClientSecret) {
    return null
  }
  return GoogleProvider({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret
  })
}

function optionalLineProvider(config: Runtime) {
  if (!config.lineLoginClientId || !config.lineLoginClientSecret) {
    return null
  }

  return {
    id: 'line',
    name: 'LINE',
    type: 'oauth',
    authorization: {
      url: 'https://access.line.me/oauth2/v2.1/authorize',
      params: { scope: 'profile openid email' }
    },
    token: 'https://api.line.me/oauth2/v2.1/token',
    userinfo: 'https://api.line.me/v2/profile',
    checks: ['state'],
    clientId: config.lineLoginClientId,
    clientSecret: config.lineLoginClientSecret,
    profile(profile: { userId?: string; displayName?: string; pictureUrl?: string }) {
      return {
        id: profile.userId || '',
        name: profile.displayName || 'LINE User',
        email: null,
        image: profile.pictureUrl || null
      }
    }
  }
}

function optionalMagicLinkProvider(config: Runtime) {
  if (!config.resendApiKey) {
    return null
  }

  const EmailProvider = require('next-auth/providers/email').default as typeof import('next-auth/providers/email').default
  const resend = new Resend(config.resendApiKey)
  const from = config.authMagicLinkFrom || 'Washpoint <onboarding@resend.dev>'
  return EmailProvider({
    from,
    async sendVerificationRequest({ identifier, url, provider }) {
      await resend.emails.send({
        from: provider.from || from,
        to: identifier,
        subject: 'Sign in to Washpoint',
        html: `<p>คลิกลิงก์เพื่อเข้าสู่ระบบ:</p><p><a href="${url}">${url}</a></p>`
      })
    }
  })
}

const runtimeConfig = useRuntimeConfig()
const authHandler = NuxtAuthHandler({
  secret: runtimeConfig.authSecret || 'dev-auth-secret-change-me',
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/auth/signin'
  },
  providers: [
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim()
        const password = credentials?.password
        if (!email || !password) return null

        const user = await prisma.user.findUnique({
          where: { email }
        })
        if (!user || !user.passwordHash || !user.isActive) return null

        const ok = await verifyPassword(password, user.passwordHash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          tenantId: user.tenantId,
          merchantAccountId: user.merchantAccountId
        }
      }
    }),
    ...[optionalGoogleProvider(useRuntimeConfig()), optionalLineProvider(useRuntimeConfig()), optionalMagicLinkProvider(useRuntimeConfig())].filter(Boolean) as any[]
  ] as any[],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const appUser = user as typeof user & {
          role?: 'ADMIN' | 'USER'
          tenantId?: string | null
          merchantAccountId?: string | null
        }
        token.role = appUser.role || 'USER'
        token.tenantId = appUser.tenantId || null
        token.merchantAccountId = appUser.merchantAccountId || null
      }
      return token
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: (token.sub as string | undefined) || session.user?.id,
        role: ((token.role as 'ADMIN' | 'USER' | undefined) || 'USER') as 'ADMIN' | 'USER',
        tenantId: (token.tenantId as string | null | undefined) || null,
        merchantAccountId: (token.merchantAccountId as string | null | undefined) || null
      }
      return session
    }
  }
})

export default authHandler
