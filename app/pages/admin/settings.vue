<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  SYSTEM_SETTINGS_CATALOG,
  SYSTEM_SETTING_KEYS,
  SYSTEM_SETTING_ORDER,
  type SystemSettingCatalogKey
} from '../../../shared/system-settings-catalog'

definePageMeta({
  middleware: 'platform-admin-auth'
})

type SettingItem = {
  key: string
  value: unknown
  updatedAt: string
}

type ConfigRow = {
  key: SystemSettingCatalogKey
  label: string
  value: string
  rawValue: string | number | boolean
  description: string
  updatedAt: string | null
  editable: boolean
  tone?: 'success' | 'warning' | 'info' | 'neutral'
}

const paymentExpiryMinutes = ref(15)
const emailVerificationExpiryMinutes = ref(60)
const passwordResetExpiryMinutes = ref(30)
const platformInitialized = ref(false)
const platformInitializedAt = ref<string | null>(null)
const settings = ref<SettingItem[]>([])
const loading = ref(false)
const saving = ref(false)
const resettingKey = ref('')
const message = ref('')
const error = ref('')
const settingSearch = ref('')
const settingFilter = ref<'all' | 'resettable'>('all')
const editOpen = ref(false)
const editingKey = ref<SystemSettingCatalogKey | ''>('')
const editNumberValue = ref<number | null>(null)
const editSaving = ref(false)

const inputUi = {
  base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500'
}

const settingsMap = computed(() => new Map(settings.value.map((item) => [item.key, item.updatedAt])))

function getConfigValue(key: SystemSettingCatalogKey) {
  if (key === SYSTEM_SETTING_KEYS.platformInitialized) {
    return platformInitialized.value
  }
  if (key === SYSTEM_SETTING_KEYS.paymentExpiryMinutes) {
    return paymentExpiryMinutes.value
  }
  if (key === SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes) {
    return emailVerificationExpiryMinutes.value
  }
  if (key === SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes) {
    return passwordResetExpiryMinutes.value
  }
  return ''
}

function formatConfigValue(key: SystemSettingCatalogKey, value: string | number | boolean) {
  if (key === SYSTEM_SETTING_KEYS.platformInitialized) {
    return value ? 'TRUE' : 'FALSE'
  }

  if (
    key === SYSTEM_SETTING_KEYS.paymentExpiryMinutes ||
    key === SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes ||
    key === SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes
  ) {
    return `${value} minutes`
  }

  return String(value)
}

const configRows = computed<ConfigRow[]>(() =>
  SYSTEM_SETTING_ORDER.map((key) => {
    const meta = SYSTEM_SETTINGS_CATALOG[key]
    const rawValue = getConfigValue(key)
    return {
      key,
      label: meta.label,
      value: formatConfigValue(key, rawValue),
      rawValue,
      description: meta.description,
      updatedAt: key === SYSTEM_SETTING_KEYS.platformInitialized
        ? platformInitializedAt.value
        : settingsMap.value.get(key) || null,
      editable: meta.editable,
      tone: key === SYSTEM_SETTING_KEYS.platformInitialized
        ? (platformInitialized.value ? 'success' : 'warning')
        : meta.tone
    }
  })
)

const filteredConfigRows = computed(() => {
  const q = settingSearch.value.trim().toLowerCase()

  return configRows.value.filter((row) => {
    const matchFilter = settingFilter.value === 'all' || isResettable(row.key)
    const haystack = `${row.label} ${row.value} ${row.description} ${row.key}`.toLowerCase()
    const matchSearch = !q || haystack.includes(q)
    return matchFilter && matchSearch
  })
})

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-GB')
}

function toneClass(tone: ConfigRow['tone']) {
  if (tone === 'success') return 'text-emerald-600 dark:text-emerald-400'
  if (tone === 'warning') return 'text-amber-600 dark:text-amber-300'
  if (tone === 'info') return 'text-sky-600 dark:text-sky-300'
  return 'text-slate-900 dark:text-slate-100'
}

function isResettable(key: SystemSettingCatalogKey) {
  return !!SYSTEM_SETTINGS_CATALOG[key]?.resettable
}

async function loadSettings() {
  loading.value = true
  error.value = ''
  message.value = ''

  try {
    const response = await $fetch<{
      paymentExpiryMinutes: number
      emailVerificationExpiryMinutes: number
      passwordResetExpiryMinutes: number
      platformInitialized: boolean
      platformInitializedAt: string | null
      settings: SettingItem[]
      catalog: typeof SYSTEM_SETTINGS_CATALOG
    }>('/api/admin/settings')

    paymentExpiryMinutes.value = response.paymentExpiryMinutes || 15
    emailVerificationExpiryMinutes.value = response.emailVerificationExpiryMinutes || 60
    passwordResetExpiryMinutes.value = response.passwordResetExpiryMinutes || 30
    platformInitialized.value = !!response.platformInitialized
    platformInitializedAt.value = response.platformInitializedAt || null
    settings.value = response.settings || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load admin settings'
  } finally {
    loading.value = false
  }
}

async function saveSystemSettings() {
  saving.value = true
  error.value = ''
  message.value = ''

  try {
    await $fetch('/api/admin/settings/system', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        emailVerificationExpiryMinutes: emailVerificationExpiryMinutes.value,
        passwordResetExpiryMinutes: passwordResetExpiryMinutes.value
      }
    })

    message.value = 'System settings have been saved.'
    await loadSettings()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to save system settings'
  } finally {
    saving.value = false
  }
}

function openEditSetting(row: ConfigRow) {
  if (!row.editable) return
  editingKey.value = row.key
  editNumberValue.value = typeof row.rawValue === 'number' ? row.rawValue : null
  editOpen.value = true
}

function closeEditSetting() {
  editOpen.value = false
  editingKey.value = ''
  editNumberValue.value = null
  editSaving.value = false
}

async function submitEditSetting() {
  if (!editingKey.value) return

  editSaving.value = true
  error.value = ''
  message.value = ''

  try {
    if (editingKey.value === SYSTEM_SETTING_KEYS.paymentExpiryMinutes) {
      paymentExpiryMinutes.value = Number(editNumberValue.value || paymentExpiryMinutes.value)
      await saveSettings()
      closeEditSetting()
      return
    }

    if (editingKey.value === SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes) {
      emailVerificationExpiryMinutes.value = Number(editNumberValue.value || emailVerificationExpiryMinutes.value)
    }

    if (editingKey.value === SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes) {
      passwordResetExpiryMinutes.value = Number(editNumberValue.value || passwordResetExpiryMinutes.value)
    }

    await saveSystemSettings()
    closeEditSetting()
  } catch {
    editSaving.value = false
  }
}

const editingRow = computed(() => configRows.value.find((row) => row.key === editingKey.value) || null)

async function saveSettings() {
  saving.value = true
  error.value = ''
  message.value = ''

  try {
    const response = await $fetch<{ success: boolean, paymentExpiryMinutes: number }>('/api/admin/settings/payment-expiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        paymentExpiryMinutes: paymentExpiryMinutes.value
      }
    })

    paymentExpiryMinutes.value = response.paymentExpiryMinutes || paymentExpiryMinutes.value
    message.value = `Saved. Payment timeout is now ${paymentExpiryMinutes.value} minutes.`
    await loadSettings()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to save admin settings'
  } finally {
    saving.value = false
  }
}

async function resetSetting(key: string) {
  resettingKey.value = key
  error.value = ''
  message.value = ''

  try {
    await $fetch('/api/admin/settings/reset', {
      method: 'POST',
      body: { key }
    })
    message.value = `${key} has been reset to default.`
    await loadSettings()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to reset setting'
  } finally {
    resettingKey.value = ''
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="mx-auto w-full max-w-none px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
    <div class="space-y-4">
      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-[240px]">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">System Settings</p>
            <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Platform Configuration</h1>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Centralized settings stored in the shared system settings table.</p>
          </div>

          <div class="flex items-center gap-2">
            <UButton color="neutral" variant="soft" :loading="loading" @click="loadSettings">Reload</UButton>
          </div>
        </div>
      </UCard>

      <UAlert v-if="message" color="success" variant="soft" icon="i-lucide-check-circle" :title="message" />
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Core Configuration</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Editable runtime settings with descriptions and status visibility in one place.</p>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ filteredConfigRows.length }} / {{ configRows.length }} items</p>
        </div>

        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div class="w-full max-w-[320px]">
            <UFormField label="Search">
              <SearchInput v-model="settingSearch" placeholder="Search setting, key, value..." />
            </UFormField>
          </div>
          <div class="w-full max-w-[220px]">
            <UFormField label="Filter">
              <select v-model="settingFilter" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                <option value="all">All settings</option>
                <option value="resettable">Resettable only</option>
              </select>
            </UFormField>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-200 text-left text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              <tr>
                <th class="px-3 py-2">Setting</th>
                <th class="px-3 py-2">Value</th>
                <th class="px-3 py-2">Description</th>
                <th class="px-3 py-2">Updated</th>
                <th class="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredConfigRows" :key="row.key" class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{{ row.label }}</td>
                <td class="px-3 py-2">
                  <span class="font-semibold" :class="toneClass(row.tone)">{{ row.value }}</span>
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ row.description }}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ formatDate(row.updatedAt) }}</td>
                <td class="px-3 py-2 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <UButton
                      v-if="row.editable"
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      @click="openEditSetting(row)"
                    />
                    <UButton
                      v-if="isResettable(row.key)"
                      icon="i-lucide-rotate-ccw"
                      color="warning"
                      variant="ghost"
                      size="xs"
                      :loading="resettingKey === row.key"
                      @click="resetSetting(row.key)"
                    />
                    <span v-if="!row.editable && !isResettable(row.key)" class="text-slate-400">-</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && filteredConfigRows.length === 0">
                <td colspan="5" class="px-3 py-6 text-center text-slate-500">No configuration items found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UModal v-model:open="editOpen" :ui="{ content: 'sm:max-w-xl' }">
        <template #content>
          <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
                  Edit {{ editingRow?.label || 'Setting' }}
                </h3>
                <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeEditSetting" />
              </div>
            </template>

            <div class="space-y-4">
              <p v-if="editingRow" class="text-sm text-slate-500 dark:text-slate-400">{{ editingRow.description }}</p>

              <UFormField v-if="editingKey === SYSTEM_SETTING_KEYS.paymentExpiryMinutes" label="Payment Expiry (minutes)">
                <UInput v-model.number="editNumberValue" type="number" min="1" max="1440" size="lg" :ui="inputUi" />
              </UFormField>

              <UFormField v-else-if="editingKey === SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes" label="Email Verification Expiry (minutes)">
                <UInput v-model.number="editNumberValue" type="number" min="1" max="1440" size="lg" :ui="inputUi" />
              </UFormField>

              <UFormField v-else-if="editingKey === SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes" label="Password Reset Expiry (minutes)">
                <UInput v-model.number="editNumberValue" type="number" min="1" max="1440" size="lg" :ui="inputUi" />
              </UFormField>

            </div>

            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton color="neutral" variant="soft" @click="closeEditSetting">Cancel</UButton>
                <UButton color="primary" class="text-white" :loading="editSaving || saving" @click="submitEditSetting">Save</UButton>
              </div>
            </template>
          </UCard>
        </template>
      </UModal>
    </div>
  </div>
</template>
