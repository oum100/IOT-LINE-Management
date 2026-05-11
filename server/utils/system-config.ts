import type { H3Event } from 'h3'
import { getNumberSetting, getStringSetting, setSystemSetting } from './system-settings'
import { QR_PAYMENT_MODE_OPTIONS, SYSTEM_SETTING_KEYS, type QrPaymentMode } from '../../shared/system-settings-catalog'

function runtimeNumber(event: H3Event, key: 'paymentExpiryMinutes' | 'emailVerificationExpiresMinutes' | 'passwordResetExpiresMinutes', fallback: number) {
  const config = useRuntimeConfig(event)
  const value = Number(config[key] || fallback)
  return Number.isFinite(value) ? value : fallback
}

export async function resolveEmailVerificationExpiryMinutes(event: H3Event) {
  const fallback = runtimeNumber(event, 'emailVerificationExpiresMinutes', 60)
  const override = await getNumberSetting(SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes, NaN)
  return Number.isFinite(override) && override >= 1 && override <= 1440 ? override : fallback
}

export async function resolvePasswordResetExpiryMinutes(event: H3Event) {
  const fallback = runtimeNumber(event, 'passwordResetExpiresMinutes', 30)
  const override = await getNumberSetting(SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes, NaN)
  return Number.isFinite(override) && override >= 1 && override <= 1440 ? override : fallback
}

export async function resolveDefaultNewUserPassword() {
  const fallback = 'P@ssw0rd'
  const configured = (await getStringSetting(SYSTEM_SETTING_KEYS.defaultNewUserPassword, fallback)).trim()
  return configured.length >= 8 ? configured : fallback
}

export async function resolveQrPaymentMode(event: H3Event): Promise<QrPaymentMode> {
  const config = useRuntimeConfig(event)
  const fallback = String(config.qrPaymentMode || 'promptpay').trim() as QrPaymentMode
  return (QR_PAYMENT_MODE_OPTIONS as readonly string[]).includes(fallback) ? fallback : 'promptpay'
}

export async function resolveMaeManeeReferencePrefix(event: H3Event) {
  const config = useRuntimeConfig(event)
  const fallback = String(config.maeManeeReferencePrefix || 'ORD').trim() || 'ORD'
  return fallback
}

export async function ensureCoreSystemSettings(values: {
  paymentExpiryMinutes: number
  defaultNewUserPassword: string
  emailVerificationExpiryMinutes: number
  passwordResetExpiryMinutes: number
  platformInitialized: boolean
}) {
  await Promise.all([
    setSystemSetting(SYSTEM_SETTING_KEYS.paymentExpiryMinutes, values.paymentExpiryMinutes),
    setSystemSetting(SYSTEM_SETTING_KEYS.defaultNewUserPassword, values.defaultNewUserPassword),
    setSystemSetting(SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes, values.emailVerificationExpiryMinutes),
    setSystemSetting(SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes, values.passwordResetExpiryMinutes),
    setSystemSetting(SYSTEM_SETTING_KEYS.platformInitialized, values.platformInitialized)
  ])
}
