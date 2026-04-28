<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"

definePageMeta({
  middleware: "portal-auth",
})

type Tenant = { id: string; name: string; code: string }
type Merchant = { id: string; name: string; code: string }
type Branch = { id: string; name: string; code: string }
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }
type MachineSummary = {
  totalCount: number
  availableCount: number
  reservedCount: number
  runningCount: number
  maintenanceCount: number
}

type MachineItem = {
  id: string
  code: string
  name: string
  kind: string
  status: "AVAILABLE" | "RESERVED" | "RUNNING" | "MAINTENANCE"
  tenant?: { id: string; name: string; code: string } | null
  merchantAccount?: { id: string; name: string } | null
  branch?: { id: string; name: string } | null
  asset?: { id: string; name: string; code: string } | null
  updatedAt: string
}

const loading = ref(false)
const error = ref("")
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
const items = ref<MachineItem[]>([])
const summary = ref<MachineSummary>({
  totalCount: 0,
  availableCount: 0,
  reservedCount: 0,
  runningCount: 0,
  maintenanceCount: 0,
})
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

function machineStatusClass(status: MachineItem["status"] | "IN_USE") {
  if (status === "IN_USE") return "text-emerald-600 dark:text-emerald-400 font-semibold"
  if (status === "AVAILABLE") return "text-emerald-600 dark:text-emerald-400 font-semibold"
  if (status === "RESERVED") return "text-cyan-600 dark:text-cyan-400 font-semibold"
  if (status === "RUNNING") return "text-blue-600 dark:text-blue-400 font-semibold"
  if (status === "MAINTENANCE") return "text-amber-600 dark:text-amber-400 font-semibold"
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
      $fetch<PagingResponse<MachineItem>>("/api/admin/machines", {
        query: {
          ...queryBase,
          ...(search.value.trim() ? { q: search.value.trim() } : {}),
          page: page.value,
          pageSize: pageSize.value,
        },
      }),
      $fetch<MachineSummary>("/api/admin/machines/summary", { query: queryBase }),
    ])
    items.value = listRes.items || []
    total.value = Number(listRes.total || 0)
    summary.value = summaryRes
  } catch (err) {
    items.value = []
    total.value = 0
    error.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || "Failed to load machines"
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadData()
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
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Machine Management</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">View and search machines by tenant/merchant (brand)/branch</p>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-[220px_220px_220px_1fr_auto_auto] md:items-end">
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
          <UInput
            v-model="search"
            placeholder="Search machine code/name/id..."
            :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }"
            @keyup.enter="applyFilters"
          />
          <UButton icon="i-lucide-search" color="primary" @click="applyFilters">Search</UButton>
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="soft" @click="loadData">Refresh</UButton>
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <UCard :ui="{ root: 'bg-emerald-50/70 dark:bg-emerald-950/25 ring-1 ring-emerald-200 dark:ring-emerald-700/40' }"><p class="text-xs text-emerald-700 dark:text-emerald-300">Total</p><p class="text-2xl font-bold text-emerald-700 dark:text-emerald-200">{{ summary.totalCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Available</p><p class="text-2xl font-bold text-emerald-500">{{ summary.availableCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Reserved</p><p class="text-2xl font-bold text-cyan-500">{{ summary.reservedCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Running</p><p class="text-2xl font-bold text-blue-500">{{ summary.runningCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Maintenance</p><p class="text-2xl font-bold text-amber-500">{{ summary.maintenanceCount }}</p></UCard>
      </div>

      <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              <th class="px-3 py-2">Code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Tenant</th>
              <th class="px-3 py-2">Merchant (Brand)</th>
              <th class="px-3 py-2">Branch</th>
              <th class="px-3 py-2">Asset</th>
              <th class="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
              <td class="px-3 py-2 font-medium">{{ item.code }}</td>
              <td class="px-3 py-2">{{ item.name }}</td>
              <td class="px-3 py-2">{{ item.kind }}</td>
              <td class="px-3 py-2">
                <span :class="machineStatusClass(item.status)">{{ item.status }}</span>
              </td>
              <td class="px-3 py-2">{{ item.tenant?.name || "-" }}</td>
              <td class="px-3 py-2">{{ item.merchantAccount?.name || "-" }}</td>
              <td class="px-3 py-2">{{ item.branch?.name || "-" }}</td>
              <td class="px-3 py-2">{{ item.asset?.name || "-" }}</td>
              <td class="px-3 py-2">{{ formatDate(item.updatedAt) }}</td>
            </tr>
            <tr v-if="!loading && items.length === 0">
              <td colspan="9" class="px-3 py-6 text-center text-slate-500">No machines found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between text-sm">
        <p class="text-slate-500 dark:text-slate-400">Showing {{ items.length }} of {{ total }} machines</p>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-chevron-left" color="neutral" variant="soft" :disabled="page <= 1" @click="page -= 1; loadData()" />
          <span class="text-xs text-slate-500 dark:text-slate-400">Page {{ page }} / {{ totalPages }}</span>
          <UButton icon="i-lucide-chevron-right" color="neutral" variant="soft" :disabled="page >= totalPages" @click="page += 1; loadData()" />
        </div>
      </div>
    </UCard>
  </section>
</template>
