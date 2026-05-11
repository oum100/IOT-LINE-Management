<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from "@internationalized/date"

definePageMeta({
  middleware: "platform-admin-auth",
})

type Tenant = { id: string; name: string; code: string }
type Merchant = { id: string; name: string; code: string }
type Branch = { id: string; name: string; code: string }
type DeviceItem = {
  id: string
  deviceUid: string | null
  macAddress: string
  name?: string | null
}
type DeviceKeyItem = {
  id: string
  keyPrefix: string
  label?: string | null
  status: "ACTIVE" | "REVOKED"
  expiresAt?: string | null
  lastUsedAt?: string | null
  createdAt: string
}
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }

const toast = useToast()
const loading = ref(false)
const creating = ref(false)
const revokingId = ref("")
const deletingId = ref("")
const generatedKey = ref("")
const expiresCalendarOpen = ref(false)

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])
const devices = ref<DeviceItem[]>([])
const keys = ref<DeviceKeyItem[]>([])

const filters = ref({
  tenantId: "",
  merchantAccountId: "",
  branchId: "",
  deviceId: "",
})

const form = ref({
  label: "",
})
const formExpiresDate = ref<CalendarDate | null>(null)

function fmtInputDate(v: CalendarDate | null) {
  if (!v) return ""
  const year = String(v.year)
  const month = String(v.month).padStart(2, "0")
  const day = String(v.day).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toIsoEndOfDay(v: CalendarDate | null) {
  if (!v) return undefined
  const base = v.toDate(getLocalTimeZone())
  base.setHours(23, 59, 59, 999)
  return base.toISOString()
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>("/api/admin/tenants", {
    query: { page: 1, pageSize: 200 },
  })
  tenants.value = response.items || []
}

async function loadMerchants() {
  if (!filters.value.tenantId) {
    merchants.value = []
    return
  }
  const response = await $fetch<PagingResponse<Merchant>>("/api/admin/merchants", {
    query: { tenantId: filters.value.tenantId, page: 1, pageSize: 200 },
  })
  merchants.value = response.items || []
}

async function loadBranches() {
  if (!filters.value.tenantId) {
    branches.value = []
    return
  }
  const response = await $fetch<PagingResponse<Branch>>("/api/admin/branches", {
    query: {
      tenantId: filters.value.tenantId,
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      page: 1,
      pageSize: 200,
    },
  })
  branches.value = response.items || []
}

async function loadDevices() {
  if (!filters.value.tenantId) {
    devices.value = []
    return
  }
  const response = await $fetch<PagingResponse<DeviceItem>>("/api/admin/devices", {
    query: {
      tenantId: filters.value.tenantId,
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      ...(filters.value.branchId ? { branchId: filters.value.branchId } : {}),
      page: 1,
      pageSize: 200,
    },
  })
  devices.value = response.items || []
  if (filters.value.deviceId && !devices.value.some(item => item.id === filters.value.deviceId)) {
    filters.value.deviceId = ""
    keys.value = []
  }
}

async function loadKeys() {
  if (!filters.value.deviceId) {
    keys.value = []
    return
  }
  loading.value = true
  try {
    const response = await $fetch<DeviceKeyItem[]>("/api/admin/device-keys", {
      query: { iotDeviceId: filters.value.deviceId },
    })
    keys.value = response || []
  } catch (err: any) {
    keys.value = []
    toast.add({
      title: "Failed to load device keys",
      description: err?.data?.statusMessage || err?.message || "Request failed",
      color: "error",
    })
  } finally {
    loading.value = false
  }
}

async function createKey() {
  if (!filters.value.deviceId) {
    toast.add({ title: "Please select device first", color: "warning" })
    return
  }
  creating.value = true
  try {
    const created = await $fetch<{ plainKey: string }>("/api/admin/device-keys", {
      method: "POST",
      body: {
        iotDeviceId: filters.value.deviceId,
        label: form.value.label.trim() || undefined,
        expiresAt: toIsoEndOfDay(formExpiresDate.value),
      },
    })
    generatedKey.value = created.plainKey || ""
    toast.add({ title: "Device key created", color: "success" })
    await loadKeys()
  } catch (err: any) {
    toast.add({
      title: "Failed to create key",
      description: err?.data?.statusMessage || err?.message || "Request failed",
      color: "error",
    })
  } finally {
    creating.value = false
  }
}

async function revokeKey(item: DeviceKeyItem) {
  revokingId.value = item.id
  try {
    await $fetch(`/api/admin/device-keys/${item.id}`, {
      method: "PATCH",
      body: { status: "REVOKED" },
    })
    toast.add({ title: "Key revoked", color: "success" })
    await loadKeys()
  } catch (err: any) {
    toast.add({
      title: "Failed to revoke key",
      description: err?.data?.statusMessage || err?.message || "Request failed",
      color: "error",
    })
  } finally {
    revokingId.value = ""
  }
}

async function deleteKey(item: DeviceKeyItem) {
  const ok = typeof window !== "undefined" ? window.confirm(`Delete key ${item.keyPrefix}?`) : true
  if (!ok) return
  deletingId.value = item.id
  try {
    await $fetch(`/api/admin/device-keys/${item.id}`, {
      method: "DELETE",
      body: { confirmText: "DELETE" },
    } as any)
    toast.add({ title: "Key deleted", color: "success" })
    await loadKeys()
  } catch (err: any) {
    toast.add({
      title: "Failed to delete key",
      description: err?.data?.statusMessage || err?.message || "Request failed",
      color: "error",
    })
  } finally {
    deletingId.value = ""
  }
}

watch(() => filters.value.tenantId, async () => {
  filters.value.merchantAccountId = ""
  filters.value.branchId = ""
  filters.value.deviceId = ""
  await Promise.all([loadMerchants(), loadBranches(), loadDevices()])
})

watch(() => filters.value.merchantAccountId, async () => {
  filters.value.branchId = ""
  filters.value.deviceId = ""
  await Promise.all([loadBranches(), loadDevices()])
})

watch(() => filters.value.branchId, async () => {
  filters.value.deviceId = ""
  await loadDevices()
})

watch(() => filters.value.deviceId, async () => {
  await loadKeys()
})

onMounted(async () => {
  await loadTenants()
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Device Keys</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage API keys for IoT devices used by bootstrap/recover/events flows.</p>
    </div>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Tenant</label>
            <select v-model="filters.tenantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">Select tenant</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Merchant</label>
            <select v-model="filters.merchantAccountId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All merchants</option>
              <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">{{ merchant.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Branch</label>
            <select v-model="filters.branchId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All branches</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Device</label>
            <select v-model="filters.deviceId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">Select device</option>
              <option v-for="item in devices" :key="item.id" :value="item.id">
                {{ item.name || '-' }} ({{ item.macAddress }})
              </option>
            </select>
          </div>
        </div>
      </template>

      <div class="grid gap-3 border-t border-slate-200 pt-3 dark:border-slate-700 md:grid-cols-4">
        <UInput v-model="form.label" placeholder="Label (optional)" :ui="{ base: 'h-10 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100' }" />
        <UPopover v-model:open="expiresCalendarOpen">
          <UInput
            :model-value="fmtInputDate(formExpiresDate)"
            readonly
            placeholder="Select expiry date"
            icon="i-lucide-calendar"
            :ui="{ base: 'h-10 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100' }"
          />
          <template #content>
            <div class="bg-white p-2 dark:bg-slate-900">
              <UCalendar v-model="formExpiresDate" @update:model-value="expiresCalendarOpen = false" />
            </div>
          </template>
        </UPopover>
        <div class="md:col-span-2 flex items-center gap-2">
          <UButton color="primary" class="text-white" :loading="creating" @click="createKey">Create Key</UButton>
          <UButton color="neutral" variant="soft" @click="loadKeys">Refresh</UButton>
        </div>
      </div>
      <p v-if="generatedKey" class="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        {{ generatedKey }}
      </p>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Device Key List</h3>
      </template>
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-200 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <tr>
              <th class="px-3 py-2">Key Prefix</th>
              <th class="px-3 py-2">Label</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Expires At</th>
              <th class="px-3 py-2">Last Used</th>
              <th class="px-3 py-2">Created</th>
              <th class="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in keys" :key="item.id" class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
              <td class="px-3 py-2 font-mono">{{ item.keyPrefix }}</td>
              <td class="px-3 py-2">{{ item.label || '-' }}</td>
              <td class="px-3 py-2">
                <span :class="item.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'">
                  {{ item.status }}
                </span>
              </td>
              <td class="px-3 py-2"><DateTimeTwoLine :value="item.expiresAt || null" /></td>
              <td class="px-3 py-2"><DateTimeTwoLine :value="item.lastUsedAt || null" /></td>
              <td class="px-3 py-2"><DateTimeTwoLine :value="item.createdAt" /></td>
              <td class="px-3 py-2">
                <div class="flex items-center justify-center gap-2">
                  <UButton
                    v-if="item.status === 'ACTIVE'"
                    icon="i-lucide-ban"
                    color="warning"
                    variant="soft"
                    size="xs"
                    :loading="revokingId === item.id"
                    @click="revokeKey(item)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="soft"
                    size="xs"
                    :loading="deletingId === item.id"
                    @click="deleteKey(item)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!loading && !keys.length">
              <td colspan="7" class="px-3 py-6 text-center text-slate-500">No keys found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </section>
</template>
