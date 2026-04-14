import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type AdminSettingsStore = {
  paymentExpiryMinutes?: number
}

const STORE_PATH = join(process.cwd(), '.data', 'admin-settings.json')

async function ensureStore() {
  await mkdir(join(process.cwd(), '.data'), { recursive: true })
}

async function readStore(): Promise<AdminSettingsStore> {
  await ensureStore()

  try {
    const raw = await readFile(STORE_PATH, 'utf8')
    return JSON.parse(raw) as AdminSettingsStore
  } catch {
    return {}
  }
}

async function writeStore(store: AdminSettingsStore) {
  await ensureStore()
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
}

export async function getAdminSettings() {
  return readStore()
}

export async function setPaymentExpiryMinutes(minutes: number) {
  const store = await readStore()
  const next: AdminSettingsStore = {
    ...store,
    paymentExpiryMinutes: minutes
  }
  await writeStore(next)

  return next
}

