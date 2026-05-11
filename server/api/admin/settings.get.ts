import { assertAdminAccess } from '../../utils/admin-auth'
import { resolvePaymentExpiryMinutes } from '../../utils/payment-expiry'
import { getPlatformState, isPlatformInitialized } from '../../utils/platform-state'
import { ensureSystemSetting, listSystemSettings } from '../../utils/system-settings'
import { SYSTEM_SETTINGS_CATALOG, SYSTEM_SETTING_KEYS } from '../../../shared/system-settings-catalog'
import {
  resolveDefaultNewUserPassword,
  resolveEmailVerificationExpiryMinutes,
  resolvePasswordResetExpiryMinutes
} from '../../utils/system-config'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)

  const [paymentExpiryMinutes, defaultNewUserPassword, emailVerificationExpiryMinutes, passwordResetExpiryMinutes, platformState, platformInitialized] = await Promise.all([
    resolvePaymentExpiryMinutes(event),
    resolveDefaultNewUserPassword(),
    resolveEmailVerificationExpiryMinutes(event),
    resolvePasswordResetExpiryMinutes(event),
    getPlatformState(),
    isPlatformInitialized()
  ])

  await Promise.all([
    ensureSystemSetting(SYSTEM_SETTING_KEYS.paymentExpiryMinutes, paymentExpiryMinutes),
    ensureSystemSetting(SYSTEM_SETTING_KEYS.defaultNewUserPassword, defaultNewUserPassword),
    ensureSystemSetting(SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes, emailVerificationExpiryMinutes),
    ensureSystemSetting(SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes, passwordResetExpiryMinutes),
    ensureSystemSetting(SYSTEM_SETTING_KEYS.platformInitialized, platformInitialized)
  ])

  const settings = await listSystemSettings()

  return {
    paymentExpiryMinutes,
    defaultNewUserPassword,
    emailVerificationExpiryMinutes,
    passwordResetExpiryMinutes,
    platformInitialized,
    platformInitializedAt: platformState.platformInitializedAt || null,
    settings,
    catalog: SYSTEM_SETTINGS_CATALOG
  }
})
