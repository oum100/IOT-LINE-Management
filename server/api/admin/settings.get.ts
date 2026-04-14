import { assertAdminAccess } from '../../utils/admin-auth'
import { resolvePaymentExpiryMinutes } from '../../utils/payment-expiry'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const paymentExpiryMinutes = await resolvePaymentExpiryMinutes(event)

  return {
    paymentExpiryMinutes
  }
})
