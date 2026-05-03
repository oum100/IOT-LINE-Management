import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getObjectSetting, getSystemSetting, getNumberSetting, setSystemSetting } from './system-settings'
import { SYSTEM_SETTING_KEYS } from '../../shared/system-settings-catalog'

type AdminSettingsStore = {
  paymentExpiryMinutes?: number
}

const STORE_PATH = join(process.cwd(), '.data', 'admin-settings.json')

export async function getAdminSettings() {
  const directValue = await getSystemSetting<number>(SYSTEM_SETTING_KEYS.paymentExpiryMinutes)
  if (typeof directValue === 'number' && Number.isFinite(directValue)) {
    return {
      paymentExpiryMinutes: directValue
    }
  }

  const saved = await getObjectSetting<AdminSettingsStore>('admin.settings', {})
  if (saved) {
    return saved
  }

  try {
    const raw = await readFile(STORE_PATH, 'utf8')
    const legacy = JSON.parse(raw) as AdminSettingsStore
    if (legacy && typeof legacy === 'object') {
      await setSystemSetting('admin.settings', legacy)
      return legacy
    }
  } catch {
    // Ignore legacy file read errors and fall back to empty settings.
  }

  return {}
}

export async function setPaymentExpiryMinutes(minutes: number) {
  const store = await getAdminSettings()
  const next: AdminSettingsStore = {
    ...store,
    paymentExpiryMinutes: minutes
  }
  await setSystemSetting(SYSTEM_SETTING_KEYS.paymentExpiryMinutes, minutes)
  await setSystemSetting('admin.settings', next)

  return next
}

export async function getPaymentExpiryMinutesSetting(fallback = 15) {
  const directValue = await getNumberSetting(SYSTEM_SETTING_KEYS.paymentExpiryMinutes, NaN)
  if (Number.isFinite(directValue) && directValue >= 1 && directValue <= 1440) {
    return directValue
  }

  const settings = await getAdminSettings()
  const nestedValue = Number(settings.paymentExpiryMinutes)
  if (Number.isFinite(nestedValue) && nestedValue >= 1 && nestedValue <= 1440) {
    return nestedValue
  }

  const legacy = await getSystemSetting<AdminSettingsStore>('admin.settings')
  const legacyValue = Number(legacy?.paymentExpiryMinutes)
  if (Number.isFinite(legacyValue) && legacyValue >= 1 && legacyValue <= 1440) {
    return legacyValue
  }

  return fallback
}
