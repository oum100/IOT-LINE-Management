<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"

definePageMeta({
  middleware: "portal-auth",
})

type Tenant = { id: string; name: string; code: string }
type Merchant = { id: string; name: string; code: string }
type Branch = { id: string; name: string; code: string }
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }
type DeviceSummary = {
  totalCount: number
  spareCount: number
  inUseCount: number
  offlineCount: number
  disabledCount: number
}

type DeviceItem = {
  id: string
  macAddress: string
  deviceUid: string | null
  name?: string | null
  model?: string | null
  status: "SPARE" | "IN_USE" | "OFFLINE" | "DISABLED"
  tenant?: { id: string; name: string; code: string } | null
  bindings?: Array<{
    asset?: {
      id: string
      name: string
      code: string
      branch?: {
        id: string
        name: string
        merchantAccount?: { id: string; name: string } | null
      } | null
    } | null
  }>
  updatedAt: string
}

const loading = ref(false)
const creating = ref(false)
const deletingId = ref("")
const error = ref("")
const createError = ref("")
const createMessage = ref("")
const createOpen = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const search = ref("")
const filters = ref({
  tenantId: "",
  merchantAccountId: "",
  branchId: "",
})

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])
const items = ref<DeviceItem[]>([])
const summary = ref<DeviceSummary>({
  totalCount: 0,
  spareCount: 0,
  inUseCount: 0,
  offlineCount: 0,
  disabledCount: 0,
})
const createForm = ref({
  macAddress: "",
  fwVersion: "",
  name: "",
  model: "",
})
const createInputUi = {
  base: "bg-slate-900 text-slate-100 placeholder:text-slate-400 ring-1 ring-slate-600",
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const generatedDeviceUid = computed(() => {
  const normalized = createForm.value.macAddress.trim().toUpperCase().replace(/[^0-9A-F]/g, "")
  if (normalized.length !== 12) return "-"
  const pairs = normalized.match(/.{1,2}/g) || []
  return pairs.reverse().join("")
})

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

function firstBinding(item: DeviceItem) {
  return item.bindings?.[0]
}

function deviceStatusClass(status: DeviceItem["status"]) {
  if (status === "IN_USE") return "text-emerald-600 dark:text-emerald-400 font-semibold"
  if (status === "SPARE") return "text-cyan-600 dark:text-cyan-400 font-semibold"
  if (status === "OFFLINE") return "text-amber-600 dark:text-amber-400 font-semibold"
  if (status === "DISABLED") return "text-rose-600 dark:text-rose-400 font-semibold"
  return "text-slate-700 dark:text-slate-200 font-semibold"
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

async function loadData() {
  loading.value = true
  error.value = ""
  try {
    const queryBase = {
      ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      ...(filters.value.branchId ? { branchId: filters.value.branchId } : {}),
    }
    const [listRes, summaryRes] = await Promise.all([
      $fetch<PagingResponse<DeviceItem>>("/api/admin/devices", {
        query: {
          ...queryBase,
          ...(search.value.trim() ? { q: search.value.trim() } : {}),
          page: page.value,
          pageSize: pageSize.value,
        },
      }),
      $fetch<DeviceSummary>("/api/admin/devices/summary", { query: queryBase }),
    ])

    items.value = listRes.items || []
    total.value = Number(listRes.total || 0)
    summary.value = summaryRes
  } catch (err) {
    items.value = []
    total.value = 0
    error.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || "Failed to load devices"
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadData()
}

function openCreateDialog() {
  if (!filters.value.tenantId) {
    error.value = "Please select tenant before creating device."
    return
  }
  createError.value = ""
  createForm.value = {
    macAddress: "",
    fwVersion: "",
    name: "",
    model: "",
  }
  createOpen.value = true
}

function closeCreateDialog() {
  createError.value = ""
  createOpen.value = false
}

async function createDevice() {
  if (!filters.value.tenantId) {
    error.value = "Tenant is required."
    return
  }
  if (!createForm.value.macAddress.trim()) {
    error.value = "MAC address is required."
    return
  }
  if (!createForm.value.fwVersion.trim()) {
    error.value = "Firmware version is required."
    return
  }

  creating.value = true
  error.value = ""
  createError.value = ""
  createMessage.value = ""
  try {
    const created = await $fetch<{ deviceUid?: string | null; macAddress: string }>("/api/admin/devices", {
      method: "POST",
      body: {
        tenantId: filters.value.tenantId,
        merchantAccountId: filters.value.merchantAccountId || null,
        branchId: filters.value.branchId || null,
        macAddress: createForm.value.macAddress.trim().toUpperCase(),
        fwVersion: createForm.value.fwVersion.trim(),
        name: createForm.value.name.trim() || null,
        model: createForm.value.model.trim() || null,
      },
    })
    createMessage.value = `Device created successfully (${created.deviceUid || created.macAddress})`
    closeCreateDialog()
    await loadData()
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || "Failed to create device"
    createError.value = message
    error.value = message
  } finally {
    creating.value = false
  }
}

async function deleteDevice(item: DeviceItem) {
  if (item.status !== "SPARE") {
    error.value = "Delete is allowed only for SPARE devices."
    return
  }
  const expectedName = (item.deviceUid || item.macAddress).trim()
  const typed = window.prompt(`Type device id to confirm delete:\n${expectedName}`, "")
  if (typed === null) return
  if (typed.trim() !== expectedName) {
    error.value = "Device id does not match. Delete cancelled."
    return
  }

  deletingId.value = item.id
  error.value = ""
  createMessage.value = ""
  try {
    await $fetch(`/api/admin/devices/${item.id}`, {
      method: "delete",
      body: {
        confirmText: "DELETE",
        confirmName: expectedName,
      },
    } as any)
    createMessage.value = `Device deleted: ${expectedName}`
    await loadData()
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || "Failed to delete device"
  } finally {
    deletingId.value = ""
  }
}

watch(
  () => filters.value.tenantId,
  async () => {
    filters.value.merchantAccountId = ""
    filters.value.branchId = ""
    await Promise.all([loadMerchants(), loadBranches()])
    applyFilters()
  },
)

watch(
  () => filters.value.merchantAccountId,
  async () => {
    filters.value.branchId = ""
    await loadBranches()
    applyFilters()
  },
)

onMounted(async () => {
  try {
    await loadTenants()
  } catch {
    tenants.value = []
  }
  await loadData()
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Device Management</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">View and search devices by tenant/merchant (brand)/branch</p>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
    <UAlert v-if="createMessage" color="success" variant="soft" icon="i-lucide-badge-check" :title="createMessage" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-[220px_220px_220px_1fr_auto_auto_auto] md:items-end">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Tenant</label>
            <select v-model="filters.tenantId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All tenants</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Merchant (Brand)</label>
            <select v-model="filters.merchantAccountId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All merchant (brand)</option>
              <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">{{ merchant.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Branch</label>
            <select v-model="filters.branchId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All branches</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
            </select>
          </div>
          <SearchInput
            v-model="search"
            placeholder="Search device uid/mac/id..."
            @enter="applyFilters"
          />
          <UButton icon="i-lucide-plus" color="primary" class="text-white" :loading="creating" @click="openCreateDialog">Create</UButton>
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="soft" @click="loadData">Refresh</UButton>
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <UCard :ui="{ root: 'bg-emerald-50/70 dark:bg-emerald-950/25 ring-1 ring-emerald-200 dark:ring-emerald-700/40' }"><p class="text-xs text-emerald-700 dark:text-emerald-300">Total</p><p class="text-2xl font-bold text-emerald-700 dark:text-emerald-200">{{ summary.totalCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Spare</p><p class="text-2xl font-bold text-cyan-500">{{ summary.spareCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">In Use</p><p class="text-2xl font-bold text-emerald-500">{{ summary.inUseCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Offline</p><p class="text-2xl font-bold text-amber-500">{{ summary.offlineCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Disabled</p><p class="text-2xl font-bold text-rose-500">{{ summary.disabledCount }}</p></UCard>
      </div>

      <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              <th class="px-3 py-2">Device UID</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Model</th>
              <th class="px-3 py-2">MAC</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Tenant</th>
              <th class="px-3 py-2">Merchant (Brand)</th>
              <th class="px-3 py-2">Branch</th>
              <th class="px-3 py-2">Asset</th>
              <th class="px-3 py-2">Updated</th>
              <th class="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
              <td class="px-3 py-2 font-medium">{{ item.deviceUid || "-" }}</td>
              <td class="px-3 py-2">{{ item.name || "-" }}</td>
              <td class="px-3 py-2">{{ item.model || "-" }}</td>
              <td class="px-3 py-2">{{ item.macAddress }}</td>
              <td class="px-3 py-2">
                <span :class="deviceStatusClass(item.status)">{{ item.status }}</span>
              </td>
              <td class="px-3 py-2">{{ item.tenant?.name || "-" }}</td>
              <td class="px-3 py-2">{{ firstBinding(item)?.asset?.branch?.merchantAccount?.name || "-" }}</td>
              <td class="px-3 py-2">{{ firstBinding(item)?.asset?.branch?.name || "-" }}</td>
              <td class="px-3 py-2">{{ firstBinding(item)?.asset?.name || "-" }}</td>
              <td class="px-3 py-2">{{ formatDate(item.updatedAt) }}</td>
              <td class="px-3 py-2">
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="soft"
                  :disabled="item.status !== 'SPARE' || deletingId === item.id"
                  :loading="deletingId === item.id"
                  @click="deleteDevice(item)"
                />
              </td>
            </tr>
            <tr v-if="!loading && items.length === 0">
              <td colspan="11" class="px-3 py-6 text-center text-slate-500">No devices found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between text-sm">
        <p class="text-slate-500 dark:text-slate-400">Showing {{ items.length }} of {{ total }} devices</p>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-chevron-left" color="neutral" variant="soft" :disabled="page <= 1" @click="page -= 1; loadData()" />
          <span class="text-xs text-slate-500 dark:text-slate-400">Page {{ page }} / {{ totalPages }}</span>
          <UButton icon="i-lucide-chevron-right" color="neutral" variant="soft" :disabled="page >= totalPages" @click="page += 1; loadData()" />
        </div>
      </div>
    </UCard>

    <UModal v-model:open="createOpen" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Device</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateDialog" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="createError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="createError" />

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label>
                  <span>MAC Address <span class="text-rose-500">*</span></span>
                </template>
                <UInput v-model="createForm.macAddress" placeholder="3C:E9:0E:54:C5:54" :ui="createInputUi" />
              </UFormField>
              <UFormField>
                <template #label>
                  <span>Device UID (Auto)</span>
                </template>
                <UInput :model-value="generatedDeviceUid" readonly :ui="createInputUi" />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Device Name (optional)">
                <UInput v-model="createForm.name" placeholder="IOT-Washer-01" :ui="createInputUi" />
              </UFormField>
              <UFormField label="Device Model (optional)">
                <UInput v-model="createForm.model" placeholder="ESP32-S3" :ui="createInputUi" />
              </UFormField>
            </div>

            <UFormField>
              <template #label>
                <span>FW Version <span class="text-rose-500">*</span></span>
              </template>
              <UInput v-model="createForm.fwVersion" placeholder="1.0.0" :ui="createInputUi" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreateDialog">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="creating" @click="createDevice">Create Device</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
