import { readBody } from 'h3'
import { z } from 'zod'
import { getServerSession } from '#auth'
import { setPaymentExpiryMinutes } from '../../../utils/admin-settings'
import { assertPermission } from '../../../utils/rbac'

type Role = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'

const schema = z.object({
  paymentExpiryMinutes: z.coerce.number().int().min(1).max(1440)
})

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.settings.manage')
  const session = await getServerSession(event)
  const user = session?.user as { id?: string; role?: Role; tenantId?: string | null; merchantAccountId?: string | null } | undefined
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (!user.tenantId && !user.merchantAccountId && String(user.role || '').toUpperCase() !== 'ADMIN' && String(user.role || '').toUpperCase() !== 'USER') {
    throw createError({ statusCode: 403, statusMessage: 'Tenant scope is required' })
  }

  const body = schema.parse(await readBody(event))
  const saved = await setPaymentExpiryMinutes(body.paymentExpiryMinutes)
  return {
    success: true,
    paymentExpiryMinutes: saved.paymentExpiryMinutes || body.paymentExpiryMinutes
  }
})
