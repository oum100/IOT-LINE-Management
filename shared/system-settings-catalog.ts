export const QR_PAYMENT_MODE_OPTIONS = ['promptpay', 'maemanee', 'maemanee_template'] as const
export type QrPaymentMode = typeof QR_PAYMENT_MODE_OPTIONS[number]

export const SYSTEM_SETTING_KEYS = {
  platformInitialized: 'platform.initialized',
  paymentExpiryMinutes: 'admin.paymentExpiryMinutes',
  defaultNewUserPassword: 'admin.defaultNewUserPassword',
  emailVerificationExpiryMinutes: 'auth.emailVerificationExpiresMinutes',
  passwordResetExpiryMinutes: 'auth.passwordResetExpiresMinutes',
  qrPaymentMode: 'payment.qrMode',
  maeManeeReferencePrefix: 'payment.maeManeeReferencePrefix'
} as const

export type SystemSettingCatalogKey = typeof SYSTEM_SETTING_KEYS[keyof typeof SYSTEM_SETTING_KEYS]

type SystemSettingCatalogItem = {
  label: string
  description: string
  type: 'boolean' | 'number' | 'select' | 'string'
  editable: boolean
  resettable: boolean
  defaultValue: string | number | boolean
  tone?: 'success' | 'warning' | 'info' | 'neutral'
  min?: number
  max?: number
  options?: readonly string[]
}

export const SYSTEM_SETTINGS_CATALOG: Record<SystemSettingCatalogKey, SystemSettingCatalogItem> = {
  [SYSTEM_SETTING_KEYS.platformInitialized]: {
    label: 'Platform Initialized',
    description: 'Shows whether first-time platform bootstrap has already been completed.',
    type: 'boolean',
    editable: false,
    resettable: false,
    defaultValue: false,
    tone: 'success'
  },
  [SYSTEM_SETTING_KEYS.paymentExpiryMinutes]: {
    label: 'Payment Expiry Minutes',
    description: 'Controls how long an order can wait for payment before it is treated as expired.',
    type: 'number',
    editable: true,
    resettable: true,
    defaultValue: 15,
    tone: 'info',
    min: 1,
    max: 1440
  },
  [SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes]: {
    label: 'Email Verification Expiry',
    description: 'Sets how long email verification links remain valid after registration.',
    type: 'number',
    editable: true,
    resettable: true,
    defaultValue: 60,
    min: 1,
    max: 1440
  },
  [SYSTEM_SETTING_KEYS.defaultNewUserPassword]: {
    label: 'Default Password for New User',
    description: 'Default password applied when creating new user accounts without explicit password input.',
    type: 'string',
    editable: true,
    resettable: true,
    defaultValue: 'P@ssw0rd'
  },
  [SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes]: {
    label: 'Password Reset Expiry',
    description: 'Sets how long password reset links remain valid after they are issued.',
    type: 'number',
    editable: true,
    resettable: true,
    defaultValue: 30,
    min: 1,
    max: 1440
  },
  [SYSTEM_SETTING_KEYS.qrPaymentMode]: {
    label: 'QR Payment Mode',
    description: 'Chooses which QR payload strategy the order flow uses at runtime.',
    type: 'select',
    editable: true,
    resettable: true,
    defaultValue: 'promptpay',
    tone: 'info',
    options: QR_PAYMENT_MODE_OPTIONS
  },
  [SYSTEM_SETTING_KEYS.maeManeeReferencePrefix]: {
    label: 'MaeManee Reference Prefix',
    description: 'Prefix applied when generating MaeManee bill payment references.',
    type: 'string',
    editable: true,
    resettable: true,
    defaultValue: 'ORD'
  }
}

export const SYSTEM_SETTING_ORDER: SystemSettingCatalogKey[] = [
  SYSTEM_SETTING_KEYS.platformInitialized,
  SYSTEM_SETTING_KEYS.paymentExpiryMinutes,
  SYSTEM_SETTING_KEYS.defaultNewUserPassword,
  SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes,
  SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes
]

export function getSystemSettingMetadata(key: string) {
  return SYSTEM_SETTINGS_CATALOG[key as SystemSettingCatalogKey] ?? null
}

export function isResettableSystemSetting(key: string) {
  return getSystemSettingMetadata(key)?.resettable === true
}

export function isEditableSystemSetting(key: string) {
  return getSystemSettingMetadata(key)?.editable === true
}
