import { prisma } from './prisma'

type SystemSettingRow = {
  key: string
  value: unknown
  updated_at: Date | string
}

export type SystemSettingItem = {
  key: string
  value: unknown
  updatedAt: string
}

async function ensureSystemSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

export async function getSystemSetting<T = unknown>(key: string): Promise<T | null> {
  await ensureSystemSettingsTable()

  const rows = await prisma.$queryRawUnsafe<SystemSettingRow[]>(
    'SELECT key, value, updated_at FROM system_settings WHERE key = $1 LIMIT 1',
    key
  )

  if (!rows.length) {
    return null
  }

  const row = rows[0]
  return row ? (row.value as T) : null
}

export async function hasSystemSetting(key: string) {
  await ensureSystemSettingsTable()

  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    'SELECT EXISTS(SELECT 1 FROM system_settings WHERE key = $1) AS exists',
    key
  )

  return !!rows[0]?.exists
}

export async function getBooleanSetting(key: string, fallback = false) {
  const value = await getSystemSetting<unknown>(key)
  if (typeof value === 'boolean') {
    return value
  }
  return fallback
}

export async function getNumberSetting(key: string, fallback = 0) {
  const value = await getSystemSetting<unknown>(key)
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

export async function getStringSetting(key: string, fallback = '') {
  const value = await getSystemSetting<unknown>(key)
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}

export async function getObjectSetting<T extends Record<string, unknown>>(key: string, fallback: T) {
  const value = await getSystemSetting<unknown>(key)
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T
  }
  return fallback
}

export async function listSystemSettings(): Promise<SystemSettingItem[]> {
  await ensureSystemSettingsTable()

  const rows = await prisma.$queryRawUnsafe<SystemSettingRow[]>(
    'SELECT key, value, updated_at FROM system_settings ORDER BY key ASC'
  )

  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    updatedAt: new Date(row.updated_at).toISOString()
  }))
}

export async function ensureSystemSetting<T = unknown>(key: string, value: T) {
  const exists = await hasSystemSetting(key)
  if (!exists) {
    await setSystemSetting(key, value)
  }

  return value
}

export async function setSystemSetting<T = unknown>(key: string, value: T) {
  await ensureSystemSettingsTable()

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `,
    key,
    JSON.stringify(value)
  )

  return value
}

export async function deleteSystemSetting(key: string) {
  await ensureSystemSettingsTable()

  await prisma.$executeRawUnsafe(
    'DELETE FROM system_settings WHERE key = $1',
    key
  )
}
