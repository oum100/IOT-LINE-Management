import { readBody } from 'h3'
import { z } from 'zod'
import { getServerSession } from '#auth'
import { setPaymentExpiryMinutes } from '../../../utils/admin-settings'

type Role = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER'

const schema = z.object({
  paymentExpiryMinutes: z.coerce.number().int().min(1).max(1440)
})

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: Role; tenantId?: string | null; merchantAccountId?: string | null } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (!user.tenantId && !user.merchantAccountId && String(user.role || '').toUpperCase() !== 'ADMIN' && String(user.role || '').toUpperCase() !== 'PLATFORM_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }

  const body = schema.parse(await readBody(event))
  const saved = await setPaymentExpiryMinutes(body.paymentExpiryMinutes)
  return {
    success: true,
    paymentExpiryMinutes: saved.paymentExpiryMinutes || body.paymentExpiryMinutes
  }
})
