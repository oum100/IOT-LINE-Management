<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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

type MqttServerItem = {
  id: string
  code: string
  name: string
  host: string
  port: number
  protocol: string
  username?: string | null
  tlsEnabled?: boolean
  qosMode?: number
  mqttVersion?: string
  connectTimeoutMs?: number
  keepAliveSec?: number
  autoReconnect?: boolean
  reconnectPeriodMs?: number
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED'
  linkedTenants: number
  canDelete: boolean
}

type TenantItem = {
  id: string
  code: string
  name: string
  status: string
}

type MqttBindingItem = {
  id: string
  tenantId: string
  mqttServerId: string
  topicPrefix: string
  active: boolean
  tenant?: { id: string; code: string; name: string } | null
  mqttServer?: { id: string; code: string; name: string } | null
}

type MqttTraceItem = {
  id: string
  direction: string
  topic: string
  qos?: number | null
  status?: string | null
  note?: string | null
  createdAt: string
  tenant?: { id: string; code: string; name: string } | null
  mqttServer?: { id: string; code: string; name: string } | null
}

const paymentExpiryMinutes = ref(15)
const defaultNewUserPassword = ref('P@ssw0rd')
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
const editStringValue = ref('')
const editSaving = ref(false)
const mqttLoading = ref(false)
const mqttSaving = ref(false)
const mqttTesting = ref(false)
const mqttServers = ref<MqttServerItem[]>([])
const mqttTenants = ref<TenantItem[]>([])
const mqttBindings = ref<MqttBindingItem[]>([])
const mqttTraces = ref<MqttTraceItem[]>([])
const mqttForm = ref({
  code: '',
  name: '',
  host: '',
  port: 1883,
  protocol: 'mqtt',
  username: '',
  password: '',
  tlsEnabled: false,
  qosMode: 0,
  mqttVersion: '3.1.1',
  connectTimeoutMs: 10000,
  keepAliveSec: 60,
  autoReconnect: true,
  reconnectPeriodMs: 3000,
  sslSecure: true,
  tlsAlpn: '',
  tlsCaCert: '',
  tlsClientCert: '',
  tlsClientKey: '',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'DISABLED'
})
const mqttPasswordVisible = ref(false)
const mqttBindForm = ref({
  tenantId: '',
  mqttServerId: '',
  topicPrefix: '',
  active: true
})
const settingsTabs = [
  { label: 'Core', value: 'core', icon: 'i-lucide-settings' },
  { label: 'MQTT', value: 'mqtt', icon: 'i-lucide-radio-tower' }
]
const activeSettingsTabModel = ref<string | number | { value?: string }>('core')
const activeSettingsTab = computed<'core' | 'mqtt'>(() => {
  const raw = activeSettingsTabModel.value
  if (typeof raw === 'string') return raw === 'mqtt' ? 'mqtt' : 'core'
  if (typeof raw === 'number') {
    const byIndex = settingsTabs[raw]?.value
    return byIndex === 'mqtt' ? 'mqtt' : 'core'
  }
  const byObj = raw?.value
  return byObj === 'mqtt' ? 'mqtt' : 'core'
})

const inputUi = {
  root: 'w-full',
  base: 'h-10 w-full bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500'
}
const mqttGeneratedCode = computed(() => {
  const seed = `${mqttForm.value.name || ''} ${mqttForm.value.host || ''}`.trim()
  const normalized = seed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16)
  return normalized || 'MQTT_SERVER'
})

watch(
  () => mqttForm.value.tlsEnabled,
  (enabled) => {
    if (enabled && mqttForm.value.protocol === 'mqtt') mqttForm.value.protocol = 'mqtts'
    if (!enabled && mqttForm.value.protocol === 'mqtts') mqttForm.value.protocol = 'mqtt'
  }
)

const settingsMap = computed(() => new Map(settings.value.map((item) => [item.key, item.updatedAt])))

function getConfigValue(key: SystemSettingCatalogKey) {
  if (key === SYSTEM_SETTING_KEYS.platformInitialized) {
    return platformInitialized.value
  }
  if (key === SYSTEM_SETTING_KEYS.paymentExpiryMinutes) {
    return paymentExpiryMinutes.value
  }
  if (key === SYSTEM_SETTING_KEYS.defaultNewUserPassword) {
    return defaultNewUserPassword.value
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
    key === SYSTEM_SETTING_KEYS.defaultNewUserPassword ||
    key === SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes ||
    key === SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes
  ) {
    if (key === SYSTEM_SETTING_KEYS.defaultNewUserPassword) return String(value)
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
      defaultNewUserPassword: string
      emailVerificationExpiryMinutes: number
      passwordResetExpiryMinutes: number
      platformInitialized: boolean
      platformInitializedAt: string | null
      settings: SettingItem[]
      catalog: typeof SYSTEM_SETTINGS_CATALOG
    }>('/api/admin/settings')

    paymentExpiryMinutes.value = response.paymentExpiryMinutes || 15
    defaultNewUserPassword.value = (response.defaultNewUserPassword || 'P@ssw0rd').trim() || 'P@ssw0rd'
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

async function loadMqttManagement() {
  mqttLoading.value = true
  try {
    const [serversRes, bindingRes, tracesRes] = await Promise.all([
      $fetch<{ items: MqttServerItem[] }>('/api/admin/mqtt/servers'),
      $fetch<{ tenants: TenantItem[]; servers: Array<{ id: string; code: string; name: string; status: string }>; bindings: MqttBindingItem[] }>('/api/admin/mqtt/bindings'),
      $fetch<{ items: MqttTraceItem[] }>('/api/admin/mqtt/traces', { query: { take: 50 } })
    ])
    mqttServers.value = serversRes.items || []
    mqttTenants.value = bindingRes.tenants || []
    mqttBindings.value = bindingRes.bindings || []
    mqttTraces.value = tracesRes.items || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load MQTT management'
  } finally {
    mqttLoading.value = false
  }
}

async function createMqttServer() {
  mqttSaving.value = true
  error.value = ''
  message.value = ''
  try {
    mqttForm.value.code = mqttGeneratedCode.value
    await $fetch('/api/admin/mqtt/servers', {
      method: 'POST',
      body: mqttForm.value
    })
    message.value = 'MQTT server created.'
    mqttForm.value = {
      code: '',
      name: '',
      host: '',
      port: 1883,
      protocol: 'mqtt',
      username: '',
      password: '',
      tlsEnabled: false,
      qosMode: 0,
      mqttVersion: '3.1.1',
      connectTimeoutMs: 10000,
      keepAliveSec: 60,
      autoReconnect: true,
      reconnectPeriodMs: 3000,
      sslSecure: true,
      tlsAlpn: '',
      tlsCaCert: '',
      tlsClientCert: '',
      tlsClientKey: '',
      status: 'ACTIVE'
    }
    mqttPasswordVisible.value = false
    await loadMqttManagement()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to create MQTT server'
  } finally {
    mqttSaving.value = false
  }
}

async function testMqttServerConnection() {
  mqttTesting.value = true
  error.value = ''
  message.value = ''
  try {
    const response = await $fetch<{ ok: boolean; detail: string }>('/api/admin/mqtt/servers/test', {
      method: 'POST',
      body: {
        host: mqttForm.value.host,
        port: mqttForm.value.port,
        protocol: mqttForm.value.protocol,
        tlsEnabled: mqttForm.value.tlsEnabled,
        connectTimeoutMs: mqttForm.value.connectTimeoutMs
      }
    })
    message.value = response.detail || 'MQTT connection test passed.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'MQTT connection test failed'
  } finally {
    mqttTesting.value = false
  }
}

async function deleteMqttServer(id: string) {
  error.value = ''
  message.value = ''
  try {
    await $fetch(`/api/admin/mqtt/servers/${id}`, { method: 'DELETE' })
    message.value = 'MQTT server deleted.'
    await loadMqttManagement()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to delete MQTT server'
  }
}

async function saveTenantMqttBinding() {
  mqttSaving.value = true
  error.value = ''
  message.value = ''
  try {
    await $fetch('/api/admin/mqtt/bindings/upsert', {
      method: 'POST',
      body: mqttBindForm.value
    })
    message.value = 'Tenant MQTT assignment saved.'
    await loadMqttManagement()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to save tenant MQTT assignment'
  } finally {
    mqttSaving.value = false
  }
}

async function deleteTenantMqttBinding(id: string) {
  error.value = ''
  message.value = ''
  try {
    await $fetch(`/api/admin/mqtt/bindings/${id}`, { method: 'DELETE' })
    message.value = 'Tenant MQTT assignment removed.'
    await loadMqttManagement()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to remove tenant MQTT assignment'
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
        defaultNewUserPassword: defaultNewUserPassword.value,
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
  editStringValue.value = typeof row.rawValue === 'string' ? row.rawValue : ''
  editOpen.value = true
}

function closeEditSetting() {
  editOpen.value = false
  editingKey.value = ''
  editNumberValue.value = null
  editStringValue.value = ''
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

    if (editingKey.value === SYSTEM_SETTING_KEYS.defaultNewUserPassword) {
      const next = editStringValue.value.trim()
      if (next.length < 8) {
        throw new Error('Default Password for new user must be at least 8 characters.')
      }
      defaultNewUserPassword.value = next
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
  loadMqttManagement()
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

      <UTabs
        v-model="activeSettingsTabModel"
        :items="settingsTabs"
        :content="false"
        :ui="{
          root: 'w-fit',
          list: 'bg-slate-200/70 p-1 dark:bg-slate-800/80',
          trigger: 'text-sm text-slate-600 dark:text-slate-300 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900',
          indicator: 'ring-0 shadow-none'
        }"
      />

      <UAlert v-if="message" color="success" variant="soft" icon="i-lucide-check-circle" :title="message" />
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

      <UCard v-if="activeSettingsTab === 'mqtt'" :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">MQTT Management</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Manage multi-broker MQTT connections and assign tenant topic prefixes.</p>
          </div>
          <UButton color="neutral" variant="soft" :loading="mqttLoading" @click="loadMqttManagement">Reload MQTT</UButton>
        </div>

        <div class="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Create MQTT Server</h3>
            <div class="space-y-3">
              <div class="grid gap-3 md:grid-cols-4">
                <div class="w-full">
                <UFormField label="Name" class="w-full">
                  <UInput v-model="mqttForm.name" :ui="inputUi" />
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="Host" class="w-full">
                  <UInput v-model="mqttForm.host" :ui="inputUi" />
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="Username" class="w-full">
                  <UInput v-model="mqttForm.username" :ui="inputUi" />
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="Password" class="w-full">
                  <div class="relative">
                    <UInput
                      v-model="mqttForm.password"
                      :type="mqttPasswordVisible ? 'text' : 'password'"
                      :ui="inputUi"
                      class="w-full"
                    />
                    <UButton
                      :icon="mqttPasswordVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      type="button"
                      class="absolute right-2 top-1/2 -translate-y-1/2"
                      aria-label="Toggle MQTT password visibility"
                      @click="mqttPasswordVisible = !mqttPasswordVisible"
                    />
                  </div>
                </UFormField>
                </div>
              </div>

              <div class="grid gap-3 md:grid-cols-4">
                <div class="w-full">
                <UFormField label="Protocol" class="w-full">
                  <select v-model="mqttForm.protocol" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                    <option value="mqtt">mqtt</option>
                    <option value="mqtts">mqtts</option>
                    <option value="ws">ws</option>
                    <option value="wss">wss</option>
                  </select>
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="Port" class="w-full">
                  <UInput v-model.number="mqttForm.port" type="number" :ui="inputUi" />
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="MQTT Version" class="w-full">
                  <select v-model="mqttForm.mqttVersion" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                    <option value="3.1">3.1</option>
                    <option value="3.1.1">3.1.1</option>
                    <option value="5.0">5.0</option>
                  </select>
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="Status" class="w-full">
                  <select v-model="mqttForm.status" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </UFormField>
                </div>
              </div>

              <div class="grid gap-3 md:grid-cols-4">
                <div class="w-full">
                <UFormField label="QoS Mode" class="w-full">
                  <select v-model.number="mqttForm.qosMode" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                    <option :value="0">0 - At most once</option>
                    <option :value="1">1 - At least once</option>
                    <option :value="2">2 - Exactly once</option>
                  </select>
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="Connection Timeout (ms)" class="w-full">
                  <UInput v-model.number="mqttForm.connectTimeoutMs" type="number" :ui="inputUi" />
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="Reconnect Period (ms)" class="w-full">
                  <UInput v-model.number="mqttForm.reconnectPeriodMs" type="number" :ui="inputUi" :disabled="!mqttForm.autoReconnect" />
                </UFormField>
                </div>
                <div class="w-full">
                <UFormField label="Keep Alive (sec)" class="w-full">
                  <UInput v-model.number="mqttForm.keepAliveSec" type="number" :ui="inputUi" />
                </UFormField>
                </div>
              </div>

              <div class="grid gap-3 md:grid-cols-4">
                <UFormField class="w-full">
                  <template #label>
                    <div class="flex items-center justify-between gap-2">
                      <span>Auto Reconnect</span>
                      <USwitch v-model="mqttForm.autoReconnect" />
                    </div>
                  </template>
                </UFormField>
                <UFormField class="w-full">
                  <template #label>
                    <div class="flex items-center justify-between gap-2">
                      <span>SSL/TLS</span>
                      <USwitch v-model="mqttForm.tlsEnabled" />
                    </div>
                  </template>
                </UFormField>
              </div>

            </div>
            <div v-if="mqttForm.tlsEnabled" class="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">TLS Configuration</p>
              <div class="grid gap-3 md:grid-cols-2">
                <UFormField class="w-full md:max-w-[220px]">
                  <template #label>
                    <div class="flex items-center justify-between gap-2">
                      <span>SSL Secure</span>
                      <USwitch v-model="mqttForm.sslSecure" />
                    </div>
                  </template>
                </UFormField>
              </div>
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <UFormField label="ALPN (optional)">
                  <UInput v-model="mqttForm.tlsAlpn" placeholder="mqtt" :ui="inputUi" />
                </UFormField>
                <UFormField label="Client Key (optional)">
                  <UTextarea v-model="mqttForm.tlsClientKey" :rows="3" :ui="inputUi" placeholder="-----BEGIN PRIVATE KEY-----" />
                </UFormField>
              </div>
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <UFormField label="CA Certificate (optional)">
                  <UTextarea v-model="mqttForm.tlsCaCert" :rows="3" :ui="inputUi" placeholder="-----BEGIN CERTIFICATE-----" />
                </UFormField>
                <UFormField label="Client Certificate (optional)">
                  <UTextarea v-model="mqttForm.tlsClientCert" :rows="3" :ui="inputUi" placeholder="-----BEGIN CERTIFICATE-----" />
                </UFormField>
              </div>
            </div>
            <div class="mt-3 flex justify-end">
              <div class="flex items-center gap-2">
                <UButton color="primary" class="text-white" :loading="mqttTesting" @click="testMqttServerConnection">Test Connection</UButton>
                <UButton color="primary" class="text-white" :loading="mqttSaving" @click="createMqttServer">Create MQTT Server</UButton>
              </div>
            </div>
        </div>

        <div class="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Assign Tenant MQTT</h3>
            <div class="grid gap-3 md:grid-cols-12 md:items-end">
              <UFormField label="Tenant" class="md:col-span-3">
                <select v-model="mqttBindForm.tenantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">Select tenant</option>
                  <option v-for="t in mqttTenants" :key="t.id" :value="t.id">{{ t.name }} ({{ t.code }})</option>
                </select>
              </UFormField>
              <UFormField label="MQTT Server" class="md:col-span-3">
                <select v-model="mqttBindForm.mqttServerId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">Select MQTT server</option>
                  <option v-for="s in mqttServers" :key="s.id" :value="s.id">{{ s.name }} ({{ s.code }})</option>
                </select>
              </UFormField>
              <UFormField label="Topic Prefix" class="md:col-span-3">
                <UInput v-model="mqttBindForm.topicPrefix" placeholder="tenant/tn-00001" :ui="inputUi" />
              </UFormField>
              <div class="md:col-span-3 flex md:justify-end">
                <UButton color="primary" class="mb-1 w-37 flex md: justify-center text-sm font-semibold text-slate-900 dark:text-slate-100" :loading="mqttSaving" @click="saveTenantMqttBinding">Save Assignment</UButton>
              </div>
            </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-200 text-left text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                <tr>
                  <th class="px-3 py-2">Server</th>
                  <th class="px-3 py-2">Host</th>
                  <th class="px-3 py-2">Status</th>
                  <th class="px-3 py-2">Linked</th>
                  <th class="px-3 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in mqttServers" :key="s.id" class="border-t border-slate-200 dark:border-slate-800">
                  <td class="px-3 py-2">{{ s.name }} <span class="text-xs text-slate-500">({{ s.code }})</span></td>
                  <td class="px-3 py-2">{{ s.host }}:{{ s.port }}</td>
                  <td class="px-3 py-2">{{ s.status }}</td>
                  <td class="px-3 py-2">{{ s.linkedTenants }}</td>
                  <td class="px-3 py-2 text-center">
                    <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :disabled="!s.canDelete" @click="deleteMqttServer(s.id)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-200 text-left text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                <tr>
                  <th class="px-3 py-2">Tenant</th>
                  <th class="px-3 py-2">MQTT Server</th>
                  <th class="px-3 py-2">Prefix</th>
                  <th class="px-3 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in mqttBindings" :key="b.id" class="border-t border-slate-200 dark:border-slate-800">
                  <td class="px-3 py-2">{{ b.tenant?.name }} <span class="text-xs text-slate-500">({{ b.tenant?.code }})</span></td>
                  <td class="px-3 py-2">{{ b.mqttServer?.name || '-' }}</td>
                  <td class="px-3 py-2">{{ b.topicPrefix }}</td>
                  <td class="px-3 py-2 text-center">
                    <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="deleteTenantMqttBinding(b.id)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-200 text-left text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              <tr>
                <th class="px-3 py-2">At</th>
                <th class="px-3 py-2">Direction</th>
                <th class="px-3 py-2">Tenant</th>
                <th class="px-3 py-2">MQTT Server</th>
                <th class="px-3 py-2">Topic</th>
                <th class="px-3 py-2">QoS</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in mqttTraces" :key="t.id" class="border-t border-slate-200 dark:border-slate-800">
                <td class="px-3 py-2">{{ formatDate(t.createdAt) }}</td>
                <td class="px-3 py-2">{{ t.direction }}</td>
                <td class="px-3 py-2">{{ t.tenant?.name || '-' }}</td>
                <td class="px-3 py-2">{{ t.mqttServer?.name || '-' }}</td>
                <td class="px-3 py-2">{{ t.topic }}</td>
                <td class="px-3 py-2">{{ t.qos ?? '-' }}</td>
                <td class="px-3 py-2">{{ t.status || '-' }}</td>
                <td class="px-3 py-2">{{ t.note || '-' }}</td>
              </tr>
              <tr v-if="!mqttTraces.length">
                <td colspan="8" class="px-3 py-6 text-center text-slate-500">No MQTT traces</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard v-if="activeSettingsTab === 'core'" :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
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

              <UFormField v-else-if="editingKey === SYSTEM_SETTING_KEYS.defaultNewUserPassword" label="Default Password for New User">
                <UInput v-model="editStringValue" type="text" size="lg" :ui="inputUi" />
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
