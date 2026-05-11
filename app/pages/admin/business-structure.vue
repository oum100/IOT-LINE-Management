<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({
  middleware: 'portal-auth'
})

type Status = 'ACTIVE' | 'SUSPENDED' | 'DISABLED'

type Tenant = {
  id: string
  code: string
  name: string
  status: Status
  createdAt?: string
  updatedAt?: string
}

type Merchant = {
  id: string
  tenantId: string
  code: string
  name: string
  status: Status
  environment: 'TEST' | 'LIVE'
  updatedAt?: string
  tenant?: { id: string; code: string; name: string } | null
}

type Branch = {
  id: string
  tenantId: string
  merchantAccountId?: string | null
  code: string
  name: string
  status: Status
  updatedAt?: string
  merchantAccount?: { id: string; code: string; name: string } | null
}

type PagingResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

type TenantSummary = {
  tenantId: string
  merchantCount: number
  branchCount: number
  assetCount: number
  deviceCount: number
  machineCount: number
  productCount: number
  paymentCount: number
  billerCount: number
  userCount: number
  orderCount: number
  totalOrderAmount: number
}

type MerchantSummary = {
  merchantId: string
  tenantId: string
  branchCount: number
  assetCount: number
  deviceCount: number
  paymentCount: number
  billerCount: number
  userCount: number
  orderCount: number
}

type BranchSummary = {
  branchId: string
  tenantId: string
  merchantAccountId: string | null
  assetCount: number
  deviceCount: number
  machineCount: number
  paymentCount: number
  orderCount: number
}

const loading = ref(false)
const summaryLoading = ref(false)
const error = ref('')
const summaryError = ref('')
const message = ref('')

const searchText = ref('')
const selectedTenantId = ref('')
const selectedMerchantId = ref('')
const selectedBranchId = ref('')

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])

const tenantSummary = ref<TenantSummary | null>(null)
const merchantSummary = ref<MerchantSummary | null>(null)
const branchSummary = ref<BranchSummary | null>(null)

function setError(err: unknown) {
  error.value = err instanceof Error ? err.message : 'Request failed'
}

function statusColor(status: Status) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED') return 'warning'
  return 'error'
}

function fmtDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function fmtMoney(value?: number) {
  return Number(value || 0).toLocaleString('th-TH')
}

const filteredMerchants = computed(() => {
  if (!selectedTenantId.value) return merchants.value
  return merchants.value.filter(item => item.tenantId === selectedTenantId.value)
})

const filteredBranches = computed(() => {
  return branches.value.filter((item) => {
    const byTenant = !selectedTenantId.value || item.tenantId === selectedTenantId.value
    const byMerchant = !selectedMerchantId.value || item.merchantAccountId === selectedMerchantId.value
    return byTenant && byMerchant
  })
})

const tenantOptions = computed(() => [
  { label: 'All tenants', value: '' },
  ...tenants.value.map(item => ({ label: `${item.code} ${item.name}`, value: item.id }))
])

const merchantOptions = computed(() => [
  { label: 'All merchants', value: '' },
  ...filteredMerchants.value.map(item => ({ label: `${item.code} ${item.name}`, value: item.id }))
])

const branchOptions = computed(() => [
  { label: 'All branches', value: '' },
  ...filteredBranches.value.map(item => ({ label: `${item.code} ${item.name}`, value: item.id }))
])

const tenantCountStats = computed(() => ({
  total: tenants.value.length,
  active: tenants.value.filter(item => item.status === 'ACTIVE').length,
  suspended: tenants.value.filter(item => item.status === 'SUSPENDED').length,
  disabled: tenants.value.filter(item => item.status === 'DISABLED').length
}))

const merchantCountStats = computed(() => ({
  total: filteredMerchants.value.length,
  active: filteredMerchants.value.filter(item => item.status === 'ACTIVE').length,
  suspended: filteredMerchants.value.filter(item => item.status === 'SUSPENDED').length,
  disabled: filteredMerchants.value.filter(item => item.status === 'DISABLED').length
}))

const branchCountStats = computed(() => ({
  total: filteredBranches.value.length,
  active: filteredBranches.value.filter(item => item.status === 'ACTIVE').length,
  suspended: filteredBranches.value.filter(item => item.status === 'SUSPENDED').length,
  disabled: filteredBranches.value.filter(item => item.status === 'DISABLED').length
}))

const scopeTitle = computed(() => {
  if (selectedBranchId.value) return 'Branch Scope'
  if (selectedMerchantId.value) return 'Merchant Scope'
  if (selectedTenantId.value) return 'Tenant Scope'
  return ''
})

const quickViewRows = computed(() => {
  const merchant = merchantSummary.value
  const branch = branchSummary.value
  const tenant = tenantSummary.value

  const merchantTotal = tenant ? tenant.merchantCount : merchantCountStats.value.total
  const branchTotal = branch ? 1 : merchant ? merchant.branchCount : tenant ? tenant.branchCount : branchCountStats.value.total
  const productTotal = tenant ? tenant.productCount : 0
  const userTotal = merchant ? merchant.userCount : tenant ? tenant.userCount : 0
  const billerTotal = merchant ? merchant.billerCount : tenant ? tenant.billerCount : 0

  const assetTotal = branch ? branch.assetCount : merchant ? merchant.assetCount : tenant ? tenant.assetCount : 0
  const deviceTotal = branch ? branch.deviceCount : merchant ? merchant.deviceCount : tenant ? tenant.deviceCount : 0
  const machineTotal = branch ? branch.machineCount : tenant ? tenant.machineCount : 0

  const revenueTotal = tenant ? fmtMoney(tenant.totalOrderAmount) : '-'
  const orderTotal = branch ? branch.orderCount : merchant ? merchant.orderCount : tenant ? tenant.orderCount : 0

  return {
    business: [
      { label: 'Merchant', total: merchantTotal },
      { label: 'Branch', total: branchTotal },
      { label: 'User', total: userTotal },
      { label: 'Biller', total: billerTotal },
      { label: 'Product', total: productTotal }
    ],
    asset: [
      { label: 'Asset', total: assetTotal },
      { label: 'Device', total: deviceTotal },
      { label: 'Machine', total: machineTotal }
    ],
    revenue: { total: revenueTotal, order: orderTotal }
  }
})

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>('/api/admin/tenants', {
    query: {
      page: 1,
      pageSize: 200,
      ...(searchText.value ? { q: searchText.value } : {})
    }
  })
  tenants.value = response.items || []
}

async function loadMerchants() {
  const response = await $fetch<PagingResponse<Merchant>>('/api/admin/merchants', {
    query: {
      page: 1,
      pageSize: 200,
      ...(selectedTenantId.value ? { tenantId: selectedTenantId.value } : {}),
      ...(searchText.value ? { q: searchText.value } : {})
    }
  })
  merchants.value = response.items || []
}

async function loadBranches() {
  const response = await $fetch<PagingResponse<Branch>>('/api/admin/branches', {
    query: {
      page: 1,
      pageSize: 200,
      ...(selectedTenantId.value ? { tenantId: selectedTenantId.value } : {}),
      ...(selectedMerchantId.value ? { merchantAccountId: selectedMerchantId.value } : {}),
      ...(searchText.value ? { q: searchText.value } : {})
    }
  })
  branches.value = response.items || []
}

async function loadScopeSummary() {
  summaryLoading.value = true
  summaryError.value = ''
  tenantSummary.value = null
  merchantSummary.value = null
  branchSummary.value = null

  try {
    if (selectedBranchId.value) {
      branchSummary.value = await $fetch<BranchSummary>(`/api/admin/branches/${selectedBranchId.value}/summary`)
      return
    }

    if (selectedMerchantId.value) {
      merchantSummary.value = await $fetch<MerchantSummary>(`/api/admin/merchants/${selectedMerchantId.value}/summary`)
      return
    }

    const tenantId = selectedTenantId.value || 'all'
    tenantSummary.value = await $fetch<TenantSummary>(`/api/admin/tenants/${tenantId}/summary`)
  } catch (err) {
    summaryError.value = err instanceof Error ? err.message : 'Failed to load summary'
  } finally {
    summaryLoading.value = false
  }
}

async function refreshAll() {
  loading.value = true
  error.value = ''
  message.value = ''

  try {
    await loadTenants()
    await loadMerchants()

    const merchantExists = !selectedMerchantId.value || merchants.value.some(item => item.id === selectedMerchantId.value)
    if (!merchantExists) selectedMerchantId.value = ''

    await loadBranches()

    const branchExists = !selectedBranchId.value || branches.value.some(item => item.id === selectedBranchId.value)
    if (!branchExists) selectedBranchId.value = ''

    await loadScopeSummary()
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

async function onTenantChange() {
  selectedMerchantId.value = ''
  selectedBranchId.value = ''
  await refreshAll()
}

async function onMerchantChange() {
  selectedBranchId.value = ''
  await refreshAll()
}

async function onBranchChange() {
  await loadScopeSummary()
}

async function onSearch() {
  await refreshAll()
}

function openTenant(item: Tenant) {
  void navigateTo(`/admin/tenant/${item.id}`)
}

function openTenantMerchants(item: Tenant) {
  void navigateTo(`/admin/merchants?tenantId=${item.id}`)
}

function openTenantBranches(item: Tenant) {
  void navigateTo(`/admin/branchs?tenantId=${item.id}`)
}

function openMerchant(item: Merchant) {
  void navigateTo(`/admin/merchants?tenantId=${item.tenantId}`)
}

function openMerchantBranches(item: Merchant) {
  void navigateTo(`/admin/branchs?tenantId=${item.tenantId}&merchantAccountId=${item.id}`)
}

function openBranch(item: Branch) {
  const tenantId = item.tenantId
  const merchantId = item.merchantAccountId || ''
  void navigateTo(`/admin/branchs?tenantId=${tenantId}${merchantId ? `&merchantAccountId=${merchantId}` : ''}`)
}

onMounted(() => {
  void refreshAll()
})
</script>

<template>
  <section class="space-y-5 text-slate-900 dark:text-slate-100">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Admin Workspace</p>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Business Structure Management</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Unified view of Tenant, Merchant, and Branch structure.</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="soft" icon="i-lucide-building-2" @click="navigateTo('/admin/tenant')">Legacy Tenant</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-store" @click="navigateTo('/admin/merchants')">Legacy Merchant</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-git-branch" @click="navigateTo('/admin/branches')">Legacy Branch</UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
    <UAlert v-if="message" color="success" variant="soft" icon="i-lucide-check-circle-2" :title="message" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-4 md:items-end">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-600 dark:text-slate-300">Tenant</label>
            <select
              v-model="selectedTenantId"
              class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              @change="onTenantChange"
            >
              <option v-for="item in tenantOptions" :key="`tenant-${item.value || 'all'}`" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-600 dark:text-slate-300">Merchant</label>
            <select
              v-model="selectedMerchantId"
              class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              @change="onMerchantChange"
            >
              <option v-for="item in merchantOptions" :key="`merchant-${item.value || 'all'}`" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-600 dark:text-slate-300">Branch</label>
            <select
              v-model="selectedBranchId"
              class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              @change="onBranchChange"
            >
              <option v-for="item in branchOptions" :key="`branch-${item.value || 'all'}`" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-600 dark:text-slate-300">Search</label>
            <SearchInput v-model="searchText" placeholder="Search code/name..." class="w-full" @enter="onSearch" />
          </div>
        </div>
      </template>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">Quick View</p>
            <p v-if="scopeTitle" class="text-sm text-slate-500 dark:text-slate-300">{{ scopeTitle }}</p>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            Revenues: <span class="font-semibold">{{ quickViewRows.revenue.total }}</span>
            <span class="mx-2 text-slate-400 dark:text-slate-500">|</span>
            Orders: <span class="font-semibold">{{ quickViewRows.revenue.order }}</span>
          </p>
        </div>
      </template>

      <UAlert v-if="summaryError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="summaryError" class="mb-3" />

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-[4fr_3fr]">
        <div>
          <p class="mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Tenant</p>
          <div class="grid h-[5.25rem] grid-cols-5 gap-2">
            <div v-for="item in quickViewRows.business" :key="`business-${item.label}`" class="flex h-full flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center dark:border-slate-700 dark:bg-slate-800/60">
              <p class="text-base text-slate-700 dark:text-slate-200">{{ item.label }}</p>
              <p class="text-xl font-semibold leading-none text-slate-900 dark:text-slate-100">{{ item.total }}</p>
            </div>
          </div>
        </div>

        <div class="h-[6.25rem]">
          <p class="mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Asset</p>
          <div class="grid h-[5.25rem] grid-cols-1 gap-2 md:grid-cols-[1.1fr_2fr] md:items-stretch">
            <div class="flex h-full flex-col items-center justify-center rounded-lg bg-slate-200/70 px-2 py-1 text-center dark:bg-slate-700/60">
              <p class="text-lg font-bold text-slate-900 dark:text-slate-100">Assets</p>
              <p class="mt-0.5 text-xl font-bold leading-none text-slate-900 dark:text-slate-100">{{ quickViewRows.asset[0]?.total ?? 0 }}</p>
            </div>

            <div class="grid h-full grid-rows-2 gap-2">
              <div class="flex h-full items-center justify-between rounded-lg border border-slate-300 bg-white px-2.5 py-1 dark:border-slate-500 dark:bg-slate-800">
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Devices</p>
                <p class="text-lg font-bold leading-none text-slate-900 dark:text-slate-100">{{ quickViewRows.asset[1]?.total ?? 0 }}</p>
              </div>
              <div class="flex h-full items-center justify-between rounded-lg border border-slate-300 bg-white px-2.5 py-1 dark:border-slate-500 dark:bg-slate-800">
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Machines</p>
                <p class="text-lg font-bold leading-none text-slate-900 dark:text-slate-100">{{ quickViewRows.asset[2]?.total ?? 0 }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <div class="grid gap-4 grid-cols-1">
      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">Tenant List</p>
            <div class="flex items-center gap-3 text-sm">
              <span class="text-slate-700 dark:text-slate-200">Total: {{ tenantCountStats.total }}</span>
              <span class="text-emerald-700 dark:text-emerald-300">Active: {{ tenantCountStats.active }}</span>
              <span class="text-amber-700 dark:text-amber-300">Suspended: {{ tenantCountStats.suspended }}</span>
              <span class="text-rose-700 dark:text-rose-300">Disabled: {{ tenantCountStats.disabled }}</span>
            </div>
          </div>
        </template>
        <div class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table class="w-full min-w-[760px] text-sm">
            <thead class="bg-slate-100/70 dark:bg-slate-800/70">
              <tr class="text-left">
                <th class="px-3 py-2">Code</th><th class="px-3 py-2">Name</th><th class="px-3 py-2">Status</th><th class="px-3 py-2">Updated</th><th class="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in tenants" :key="item.id" class="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60">
                <td class="px-3 py-2">{{ item.code }}</td><td class="px-3 py-2">{{ item.name }}</td>
                <td class="px-3 py-2"><UBadge :color="statusColor(item.status)" variant="soft">{{ item.status }}</UBadge></td>
                <td class="px-3 py-2">{{ fmtDate(item.updatedAt) }}</td>
                <td class="px-3 py-2"><div class="flex gap-1"><UButton size="xs" color="primary" variant="soft" icon="i-lucide-eye" @click="openTenant(item)" /><UButton size="xs" color="neutral" variant="soft" icon="i-lucide-store" @click="openTenantMerchants(item)" /><UButton size="xs" color="neutral" variant="soft" icon="i-lucide-map-pinned" @click="openTenantBranches(item)" /></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">Merchant List</p>
            <div class="flex items-center gap-3 text-sm">
              <span class="text-slate-700 dark:text-slate-200">Total: {{ merchantCountStats.total }}</span>
              <span class="text-emerald-700 dark:text-emerald-300">Active: {{ merchantCountStats.active }}</span>
              <span class="text-amber-700 dark:text-amber-300">Suspended: {{ merchantCountStats.suspended }}</span>
              <span class="text-rose-700 dark:text-rose-300">Disabled: {{ merchantCountStats.disabled }}</span>
            </div>
          </div>
        </template>
        <div class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table class="w-full min-w-[860px] text-sm">
            <thead class="bg-slate-100/70 dark:bg-slate-800/70">
              <tr class="text-left">
                <th class="px-3 py-2">Code</th><th class="px-3 py-2">Name</th><th class="px-3 py-2">Tenant</th><th class="px-3 py-2">Status</th><th class="px-3 py-2">Env</th><th class="px-3 py-2">Updated</th><th class="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredMerchants" :key="item.id" class="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60">
                <td class="px-3 py-2">{{ item.code }}</td><td class="px-3 py-2">{{ item.name }}</td><td class="px-3 py-2">{{ item.tenant?.name || '-' }}</td>
                <td class="px-3 py-2"><UBadge :color="statusColor(item.status)" variant="soft">{{ item.status }}</UBadge></td><td class="px-3 py-2">{{ item.environment }}</td><td class="px-3 py-2">{{ fmtDate(item.updatedAt) }}</td>
                <td class="px-3 py-2"><div class="flex gap-1"><UButton size="xs" color="primary" variant="soft" icon="i-lucide-eye" @click="openMerchant(item)" /><UButton size="xs" color="neutral" variant="soft" icon="i-lucide-map-pinned" @click="openMerchantBranches(item)" /></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">Branch List</p>
            <div class="flex items-center gap-3 text-sm">
              <span class="text-slate-700 dark:text-slate-200">Total: {{ branchCountStats.total }}</span>
              <span class="text-emerald-700 dark:text-emerald-300">Active: {{ branchCountStats.active }}</span>
              <span class="text-amber-700 dark:text-amber-300">Suspended: {{ branchCountStats.suspended }}</span>
              <span class="text-rose-700 dark:text-rose-300">Disabled: {{ branchCountStats.disabled }}</span>
            </div>
          </div>
        </template>
        <div class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table class="w-full min-w-[760px] text-sm">
            <thead class="bg-slate-100/70 dark:bg-slate-800/70">
              <tr class="text-left">
                <th class="px-3 py-2">Code</th><th class="px-3 py-2">Name</th><th class="px-3 py-2">Merchant</th><th class="px-3 py-2">Status</th><th class="px-3 py-2">Updated</th><th class="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredBranches" :key="item.id" class="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60">
                <td class="px-3 py-2">{{ item.code }}</td><td class="px-3 py-2">{{ item.name }}</td><td class="px-3 py-2">{{ item.merchantAccount?.name || '-' }}</td>
                <td class="px-3 py-2"><UBadge :color="statusColor(item.status)" variant="soft">{{ item.status }}</UBadge></td><td class="px-3 py-2">{{ fmtDate(item.updatedAt) }}</td>
                <td class="px-3 py-2"><div class="flex gap-1"><UButton size="xs" color="primary" variant="soft" icon="i-lucide-eye" @click="openBranch(item)" /></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
  </section>
</template>
