import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SYSTEM_SETTING_KEYS } from '../../shared/system-settings-catalog'
import { getBooleanSetting, getObjectSetting, setSystemSetting } from './system-settings'

type PlatformStateStore = {
  platformInitialized?: boolean
  platformInitializedAt?: string | null
}

const STORE_PATH = join(process.cwd(), '.data', 'platform-state.json')

export async function getPlatformState() {
  const saved = await getObjectSetting<PlatformStateStore>('platform.state', {})
  if (saved) {
    return saved
  }

  try {
    const raw = await readFile(STORE_PATH, 'utf8')
    const legacy = JSON.parse(raw) as PlatformStateStore
    if (legacy && typeof legacy === 'object') {
      await setSystemSetting('platform.state', legacy)
      return legacy
    }
  } catch {
    // Ignore legacy file read errors and fall back to empty state.
  }

  return {}
}

export async function isPlatformInitialized() {
  const directValue = await getBooleanSetting(SYSTEM_SETTING_KEYS.platformInitialized, false)
  if (directValue) {
    return true
  }

  const state = await getPlatformState()
  return !!state.platformInitialized
}

export async function markPlatformInitialized() {
  const store = await getPlatformState()
  const next: PlatformStateStore = {
    ...store,
    platformInitialized: true,
    platformInitializedAt: store.platformInitializedAt || new Date().toISOString()
  }
  await setSystemSetting(SYSTEM_SETTING_KEYS.platformInitialized, true)
  await setSystemSetting('platform.state', next)
  return next
}
