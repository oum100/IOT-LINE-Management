<script setup lang="ts">
definePageMeta({
  middleware: "portal-auth",
})

type TenantStatus = "ACTIVE" | "SUSPENDED" | "DISABLED"

type MerchantStatus = "ACTIVE" | "SUSPENDED" | "DISABLED"
type BranchStatus = "ACTIVE" | "SUSPENDED" | "DISABLED"

type TenantDetails = {
  id: string
  code: string
  name: string
  status: TenantStatus
  createdAt?: string
  updatedAt?: string
  metadata?: Record<string, any> | null
  merchantAccounts?: Array<{
    id: string
    code: string
    name: string
    status: MerchantStatus
  }>
  branches?: Array<{
    id: string
    code: string
    name: string
    status: BranchStatus
    merchantAccountId?: string | null
  }>
}

type TenantSummary = {
  tenantId: string
  merchantCount: number
  branchCount: number
  assetCount: number
  deviceCount: number
  paymentCount: number
  billerCount: number
  userCount: number
  orderCount: number
  totalOrderAmount: number
}

const route = useRoute()
const loading = ref(false)
const refreshing = ref(false)
const error = ref("")
const tenant = ref<TenantDetails | null>(null)
const summary = ref<TenantSummary | null>(null)

const merchantSearch = ref("")
const branchSearch = ref("")
const tenantId = computed(() => String(route.params.id || "").trim())

const tenantStatusClass = computed(() => {
  const value = tenant.value?.status
  if (value === "ACTIVE") return "text-emerald-600 dark:text-emerald-300"
  if (value === "SUSPENDED") return "text-amber-600 dark:text-amber-300"
  return "text-rose-600 dark:text-rose-300"
})

const merchants = computed(() => tenant.value?.merchantAccounts || [])
const branches = computed(() => tenant.value?.branches || [])

const filteredMerchants = computed(() => {
  const q = merchantSearch.value.trim().toLowerCase()
  if (!q) return merchants.value
  return merchants.value.filter(item =>
    item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
  )
})

const filteredBranches = computed(() => {
  const q = branchSearch.value.trim().toLowerCase()
  if (!q) return branches.value
  return branches.value.filter(item =>
    item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
  )
})

function statusClass(value: string) {
  if (value === "ACTIVE") return "text-emerald-600 dark:text-emerald-300"
  if (value === "SUSPENDED") return "text-amber-600 dark:text-amber-300"
  return "text-rose-600 dark:text-rose-300"
}

function formatMoney(value?: number) {
  return Number(value || 0).toLocaleString("th-TH")
}

function formatDate(value?: string) {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

async function navigateArea(area: "merchants" | "branchs" | "assets" | "devices" | "users" | "ops") {
  if (!tenantId.value) return
  if (area === "ops") {
    await navigateTo(`/admin/ops?tenantId=${tenantId.value}`)
    return
  }
  await navigateTo(`/admin/${area}?tenantId=${tenantId.value}`)
}

async function loadPage() {
  if (!tenantId.value) return
  loading.value = true
  error.value = ""
  try {
    const [tenantResponse, summaryResponse] = await Promise.all([
      $fetch<TenantDetails>(`/api/admin/tenants/${tenantId.value}`),
      $fetch<TenantSummary>(`/api/admin/tenants/${tenantId.value}/summary`),
    ])
    tenant.value = tenantResponse
    summary.value = summaryResponse
  } catch (err) {
    tenant.value = null
    summary.value = null
    error.value = err instanceof Error ? err.message : "Failed to load tenant details"
  } finally {
    loading.value = false
  }
}

async function refreshPage() {
  refreshing.value = true
  await loadPage()
  refreshing.value = false
}

onMounted(() => {
  void loadPage()
})

watch(tenantId, () => {
  void loadPage()
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant Details</p>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
          {{ tenant?.name || "Tenant" }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Code: {{ tenant?.code || "-" }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left" @click="navigateTo('/admin/tenant')">
          Back
        </UButton>
        <UButton color="primary" variant="soft" icon="i-lucide-refresh-cw" :loading="refreshing" @click="refreshPage">
          Refresh
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      :title="error"
    />

    <div v-if="loading" class="rounded-lg border border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
      Loading tenant details...
    </div>

    <template v-else-if="tenant && summary">
      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="grid gap-3 md:grid-cols-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
            <p class="mt-1 text-lg font-bold" :class="tenantStatusClass">{{ tenant.status }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Revenue</p>
            <p class="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-300">{{ formatMoney(summary.totalOrderAmount) }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Created</p>
            <p class="mt-1 text-sm text-slate-700 dark:text-slate-200">{{ formatDate(tenant.createdAt) }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Updated</p>
            <p class="mt-1 text-sm text-slate-700 dark:text-slate-200">{{ formatDate(tenant.updatedAt) }}</p>
          </div>
        </div>
      </UCard>

      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Quick Management</h2>
        </template>
        <div class="overflow-x-auto">
          <div class="grid min-w-[1100px] grid-cols-8 gap-2">
            <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="navigateArea('merchants')">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Merchants</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ summary.merchantCount }}</p>
            </button>
            <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="navigateArea('branchs')">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Branches</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ summary.branchCount }}</p>
            </button>
            <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="navigateArea('assets')">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Assets</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ summary.assetCount }}</p>
            </button>
            <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="navigateArea('devices')">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">IoT Devices</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ summary.deviceCount }}</p>
            </button>
            <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="navigateArea('ops')">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Orders</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ summary.orderCount }}</p>
            </button>
            <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="navigateArea('ops')">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Payments</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ summary.paymentCount }}</p>
            </button>
            <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="navigateArea('ops')">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Billers</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ summary.billerCount }}</p>
            </button>
            <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="navigateArea('users')">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Users</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ summary.userCount }}</p>
            </button>
          </div>
        </div>
      </UCard>

      <div class="grid gap-4 xl:grid-cols-2">
        <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Merchant (Brand) List</h2>
              <SearchInput v-model="merchantSearch" placeholder="Search merchant..." class="w-[260px]" />
            </div>
          </template>
          <div class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table class="w-full min-w-[460px] text-sm">
              <thead class="bg-slate-100/70 dark:bg-slate-800/70">
                <tr class="text-left">
                  <th class="px-3 py-2">Name</th>
                  <th class="px-3 py-2">Code</th>
                  <th class="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredMerchants" :key="item.id" class="border-t border-slate-200 dark:border-slate-800">
                  <td class="px-3 py-2">{{ item.name }}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{{ item.code }}</td>
                  <td class="px-3 py-2 text-xs font-semibold" :class="statusClass(item.status)">{{ item.status }}</td>
                </tr>
                <tr v-if="filteredMerchants.length === 0">
                  <td colspan="3" class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">No merchants</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Branch List</h2>
              <SearchInput v-model="branchSearch" placeholder="Search branch..." class="w-[260px]" />
            </div>
          </template>
          <div class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table class="w-full min-w-[460px] text-sm">
              <thead class="bg-slate-100/70 dark:bg-slate-800/70">
                <tr class="text-left">
                  <th class="px-3 py-2">Name</th>
                  <th class="px-3 py-2">Code</th>
                  <th class="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredBranches" :key="item.id" class="border-t border-slate-200 dark:border-slate-800">
                  <td class="px-3 py-2">{{ item.name }}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{{ item.code }}</td>
                  <td class="px-3 py-2 text-xs font-semibold" :class="statusClass(item.status)">{{ item.status }}</td>
                </tr>
                <tr v-if="filteredBranches.length === 0">
                  <td colspan="3" class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">No branches</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>
    </template>
  </section>
</template>
