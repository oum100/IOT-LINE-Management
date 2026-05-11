import { z } from 'zod'
import { Resend } from 'resend'
import { hashPassword } from '../../utils/password'
import { prisma } from '../../utils/prisma'
import { createEmailVerificationToken } from '../../utils/email-verification'
import { resolveEmailVerificationExpiryMinutes } from '../../utils/system-config'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(120).optional(),
  tenantCode: z.string().trim().min(1).optional(),
  merchantCode: z.string().trim().min(1).optional()
})

export default defineEventHandler(async (event) => {
  const body = registerSchema.parse(await readBody(event))
  const email = body.email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  })
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email is already registered'
    })
  }

  let tenantId: string | null = null
  let merchantAccountId: string | null = null

  if (body.tenantCode) {
    const tenant = await prisma.tenant.findUnique({
      where: { code: body.tenantCode },
      select: { id: true }
    })
    tenantId = tenant?.id || null
  }

  if (body.merchantCode && tenantId) {
    const merchant = await prisma.merchantAccount.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: body.merchantCode
        }
      },
      select: { id: true }
    })
    merchantAccountId = merchant?.id || null
  }

  const passwordHash = await hashPassword(body.password)
  const created = await prisma.user.create({
    data: {
      email,
      name: body.name?.trim() || null,
      passwordHash,
      role: 'STAFF',
      tenantId,
      merchantAccountId
    },
    select: {
      id: true,
      email: true,
      name: true
    }
  })

  const config = useRuntimeConfig()
  const authSecret = config.authSecret || 'dev-auth-secret-change-me'
  const expiresInMinutes = await resolveEmailVerificationExpiryMinutes(event)
  const token = createEmailVerificationToken({
    email,
    secret: authSecret,
    expiresInMinutes
  })

  const authOrigin = String(config.authOrigin || '').trim()
  const authOriginBase = authOrigin.replace(/\/api\/auth\/?$/i, '')
  const baseUrl =
    authOriginBase ||
    config.public.appUrl ||
    `${getRequestProtocol(event)}://${getRequestHost(event)}`
  const verifyUrl = `${baseUrl.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(token)}`

  if (process.dev) {
    console.info('[auth][register] verify recipient:', email)
    console.info('[auth][register] verify url:', verifyUrl)
  }

  const from = config.authMagicLinkFrom || 'Washpoint <onboarding@resend.dev>'
  if (config.resendApiKey) {
    const resend = new Resend(config.resendApiKey)
    await resend.emails.send({
      from,
      to: email,
      subject: 'Verify your Washpoint account',
      html: `
        <p>Hi ${created.name || 'there'},</p>
        <p>Thank you for registering. Please verify your email:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in ${expiresInMinutes} minutes.</p>
      `
    })
  }

  return {
    ok: true,
    user: created,
    verification: {
      required: true
    }
  }
})
