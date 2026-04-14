import { readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { setPaymentExpiryMinutes } from '../../../utils/admin-settings'

const schema = z.object({
  paymentExpiryMinutes: z.number().int().min(1).max(1440)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const body = schema.parse(await readBody(event))
  const saved = await setPaymentExpiryMinutes(body.paymentExpiryMinutes)

  return {
    success: true,
    paymentExpiryMinutes: saved.paymentExpiryMinutes || body.paymentExpiryMinutes
  }
})
