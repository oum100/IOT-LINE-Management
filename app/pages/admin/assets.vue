<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"

definePageMeta({
  middleware: "portal-auth",
})

type Tenant = {
  id: string
  code: string
  name: string
}

type Branch = {
  id: string
  code: string
  name: string
}

type Merchant = {
  id: string
  code: string
  name: string
}

type Asset = {
  id: string
  code: string
  name: string
  kind: string
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE"
  assetUuid: string
  branch?: {
    id: string
    code: string
    name: string
  } | null
  createdAt: string
  updatedAt: string
}

type PagingResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

type AssetSummary = {
  totalCount: number
  activeCount: number
  inactiveCount: number
  maintenanceCount: number
  deviceCount: number
  paymentCount: number
  orderCount: number
}

type ListFilters = {
  tenantId: string
  merchantAccountId: string
  branchId: string
  q: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref("")
const filters = ref<ListFilters>({
  tenantId: "",
  merchantAccountId: "",
  branchId: "",
  q: "",
})
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const assets = ref<Asset[]>([])
const summary = ref<AssetSummary | null>(null)
const selectedAssetId = ref("")
const selectedSummary = ref<AssetSummary | null>(null)
const summaryError = ref("")
const summaryLoading = ref(false)

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasPrevPage = computed(() => page.value > 1)
const hasNextPage = computed(() => page.value < totalPages.value)
const selectedAsset = computed(() => assets.value.find(item => item.id === selectedAssetId.value) || null)
const cardSummary = computed(() => selectedSummary.value || summary.value)

function setError(err: unknown) {
  error.value = err instanceof Error ? err.message : "Request failed"
}

function resetPage() {
  page.value = 1
}

function assetStatusClass(status: Asset["status"]) {
  if (status === "ACTIVE") return "text-emerald-600 dark:text-emerald-400"
  if (status === "INACTIVE") return "text-rose-600 dark:text-rose-400"
  return "text-amber-600 dark:text-amber-400"
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function branchLabel(branch?: Asset["branch"] | null) {
  if (!branch) return "-"
  return branch.name
}

function kindLabel(kind: Asset["kind"]) {
  if (!kind) return "-"
  return kind.charAt(0) + kind.slice(1).toLowerCase()
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>("/api/admin/tenants", {
    query: {
      page: 1,
      pageSize: 200,
    },
  })
  tenants.value = response.items || []
}

function readQueryParams() {
  const tenantId = typeof route.query.tenantId === "string" ? route.query.tenantId : ""
  const merchantAccountId = typeof route.query.merchantAccountId === "string" ? route.query.merchantAccountId : ""
  const branchId = typeof route.query.branchId === "string" ? route.query.branchId : ""
  const q = typeof route.query.q === "string" ? route.query.q : ""
  const pageQuery = Number(route.query.page)
  const pageSizeQuery = Number(route.query.pageSize)

  filters.value.tenantId = tenantId
  filters.value.merchantAccountId = merchantAccountId
  filters.value.branchId = branchId
  filters.value.q = q

  if (!Number.isNaN(pageQuery) && pageQuery > 0) page.value = pageQuery
  if (!Number.isNaN(pageSizeQuery) && pageSizeQuery > 0) pageSize.value = Math.min(50, pageSizeQuery)
}

async function loadMerchants(tenantId: string) {
  if (!tenantId) {
    merchants.value = []
    return
  }

  const response = await $fetch<PagingResponse<Merchant>>("/api/admin/merchants", {
    query: {
      tenantId,
      page: 1,
      pageSize: 200,
    },
  })
  merchants.value = response.items || []
}

async function loadBranches(tenantId: string, merchantAccountId = "") {
  if (!tenantId) {
    branches.value = []
    return
  }

  const response = await $fetch<PagingResponse<Branch>>("/api/admin/branches", {
    query: {
      tenantId,
      ...(merchantAccountId ? { merchantAccountId } : {}),
      page: 1,
      pageSize: 200,
    },
  })
  branches.value = response.items || []
}

async function loadAssets() {
  if (!filters.value.tenantId) {
    assets.value = []
    total.value = 0
    summary.value = null
    selectedAssetId.value = ""
    selectedSummary.value = null
    return
  }

  loading.value = true
  error.value = ""
  try {
    const baseQuery = {
      tenantId: filters.value.tenantId,
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      ...(filters.value.branchId ? { branchId: filters.value.branchId } : {}),
    }

    const [response, summaryResponse] = await Promise.all([
      $fetch<PagingResponse<Asset>>("/api/admin/assets", {
        query: {
          ...baseQuery,
          ...(filters.value.q ? { q: filters.value.q } : {}),
          page: page.value,
          pageSize: pageSize.value,
        },
      }),
      $fetch<AssetSummary>("/api/admin/assets/summary", {
        query: baseQuery,
      }),
    ])

    assets.value = response.items || []
    total.value = Number(response.total || 0)
    page.value = Number(response.page || page.value)
    pageSize.value = Number(response.pageSize || pageSize.value)
    summary.value = summaryResponse

    if (selectedAssetId.value && !assets.value.some((item) => item.id === selectedAssetId.value)) {
      selectedAssetId.value = ""
      selectedSummary.value = null
    }
  } catch (err) {
    assets.value = []
    total.value = 0
    summary.value = null
    selectedAssetId.value = ""
    selectedSummary.value = null
    setError(err)
  } finally {
    loading.value = false
  }
}

function selectAsset(item: Asset) {
  selectedAssetId.value = item.id
}

async function loadSelectedAssetSummary(assetId: string) {
  summaryLoading.value = true
  summaryError.value = ""
  try {
    selectedSummary.value = await $fetch<AssetSummary>(`/api/admin/assets/${assetId}/summary`)
  } catch (err) {
    selectedSummary.value = null
    summaryError.value = err instanceof Error ? err.message : "Failed to load selected asset summary"
  } finally {
    summaryLoading.value = false
  }
}

function syncRoute() {
  const query: Record<string, string | number> = {
    tenantId: filters.value.tenantId,
    page: page.value,
    pageSize: pageSize.value,
  }
  if (filters.value.branchId) {
    query.branchId = filters.value.branchId
  }
  if (filters.value.merchantAccountId) {
    query.merchantAccountId = filters.value.merchantAccountId
  }
  if (filters.value.q) {
    query.q = filters.value.q
  }
  void router.replace({ query })
}

async function loadInitialState() {
  try {
    await loadTenants()
    readQueryParams()
    if (!filters.value.tenantId && tenants.value.length) {
      filters.value.tenantId = tenants.value[0]!.id
    }
    await loadMerchants(filters.value.tenantId)
    if (filters.value.merchantAccountId && !merchants.value.some((item) => item.id === filters.value.merchantAccountId)) {
      filters.value.merchantAccountId = ""
    }
    await loadBranches(filters.value.tenantId, filters.value.merchantAccountId)
    if (filters.value.branchId && !branches.value.some((item) => item.id === filters.value.branchId)) {
      filters.value.branchId = ""
    }
    await loadAssets()
  } catch (err) {
    setError(err)
  }
}

function onSearch() {
  resetPage()
  void loadAssets()
  syncRoute()
}

function onTenantChange() {
  resetPage()
  void (async () => {
    filters.value.merchantAccountId = ""
    await loadMerchants(filters.value.tenantId)
    await loadBranches(filters.value.tenantId, filters.value.merchantAccountId)
    if (filters.value.branchId && !branches.value.some((item) => item.id === filters.value.branchId)) {
      filters.value.branchId = ""
    }
    await loadAssets()
    syncRoute()
  })()
}

function onMerchantChange() {
  resetPage()
  void (async () => {
    await loadBranches(filters.value.tenantId, filters.value.merchantAccountId)
    if (filters.value.branchId && !branches.value.some((item) => item.id === filters.value.branchId)) {
      filters.value.branchId = ""
    }
    await loadAssets()
    syncRoute()
  })()
}

function onBranchChange() {
  resetPage()
  void (async () => {
    await loadAssets()
    syncRoute()
  })()
}

function onPageChange(target: number) {
  const next = Math.min(Math.max(1, target), totalPages.value)
  if (next === page.value) return
  page.value = next
  void loadAssets()
  syncRoute()
}

onMounted(() => {
  void loadInitialState()
})

watch(page, () => {
  syncRoute()
})

watch(() => route.query.tenantId, () => {
  const nextTenant = typeof route.query.tenantId === "string" ? route.query.tenantId : ""
  if (!nextTenant) return
  if (nextTenant !== filters.value.tenantId) {
    filters.value.tenantId = nextTenant
    void loadTenants().then(() => void onTenantChange())
  }
})

watch(() => route.query.merchantAccountId, () => {
  const nextMerchant = typeof route.query.merchantAccountId === "string" ? route.query.merchantAccountId : ""
  if (nextMerchant !== filters.value.merchantAccountId) {
    filters.value.merchantAccountId = nextMerchant
    void onMerchantChange()
  }
})

watch(selectedAssetId, (assetId) => {
  if (!assetId) {
    selectedSummary.value = null
    summaryError.value = ""
    return
  }
  void loadSelectedAssetSummary(assetId)
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Asset Management</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        View and search assets by tenant/branch
      </p>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-[1fr_220px_220px_220px_1fr_auto] md:items-end">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Tenant</label>
            <select
              v-model="filters.tenantId"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              @change="onTenantChange"
            >
              <option value="">Select tenant</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                {{ tenant.name }}
              </option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Merchant</label>
            <select
              v-model="filters.merchantAccountId"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              @change="onMerchantChange"
            >
              <option value="">All merchants</option>
              <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">
                {{ merchant.name }}
              </option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Branch</label>
            <select
              v-model="filters.branchId"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              @change="onBranchChange"
            >
              <option value="">All branches</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                {{ branch.name }}
              </option>
            </select>
          </div>
          <div class="col-span-2 flex items-end gap-2">
            <UInput
              v-model="filters.q"
              placeholder="Search code/name/asset uuid..."
              class="w-full bg-white dark:bg-slate-950"
              :ui="{
                base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600',
              }"
            />
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-search"
              class="text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60"
              :loading="loading"
              @click="onSearch"
            >
              Search
            </UButton>
          </div>
          <div class="flex justify-end">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-refresh-cw"
              class="text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60"
              :loading="loading"
              @click="loadAssets"
            >
              Refresh
            </UButton>
          </div>
        </div>
      </template>

      <div v-if="selectedAsset" class="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Selected asset: <span class="font-semibold text-slate-700 dark:text-slate-200">{{ selectedAsset.code }} {{ selectedAsset.name }}</span>
      </div>

      <UAlert
        v-if="summaryError"
        color="error"
        variant="soft"
        icon="i-lucide-alert-triangle"
        :title="summaryError"
        class="mb-3"
      />

      <div v-if="summaryLoading" class="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Loading selected asset summary...
      </div>

      <div v-if="cardSummary" class="mb-3">
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <div class="rounded-md border border-emerald-300/40 bg-emerald-50/60 px-3 py-2 dark:border-emerald-700/40 dark:bg-emerald-900/20">
            <p class="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Total</p>
            <p class="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-200">{{ cardSummary.totalCount }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Active</p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ cardSummary.activeCount }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Inactive</p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ cardSummary.inactiveCount }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Maintenance</p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ cardSummary.maintenanceCount }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Device</p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ cardSummary.deviceCount }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Payment</p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ cardSummary.paymentCount }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Order</p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ cardSummary.orderCount }}</p>
          </div>
        </div>
      </div>

      <div v-if="loading && !assets.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading assets...
      </div>

      <div v-else class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table class="w-full min-w-[1100px] text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr class="text-left">
              <th class="px-3 py-2">Asset Code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Branch</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="asset in assets"
              :key="asset.id"
              class="cursor-pointer border-t border-slate-200 transition-colors duration-150 dark:border-slate-800"
              :class="selectedAssetId === asset.id
                ? 'bg-blue-100/80 text-slate-900 hover:bg-blue-200/80 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-700/80'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'"
              @click="selectAsset(asset)"
            >
              <td class="px-3 py-2">
                <span class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {{ asset.code }}
                </span>
              </td>
              <td class="px-3 py-2">{{ asset.name }}</td>
              <td class="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{{ kindLabel(asset.kind) }}</td>
              <td class="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{{ branchLabel(asset.branch) }}</td>
              <td class="px-3 py-2">
                <span class="text-xs font-semibold" :class="assetStatusClass(asset.status)">
                  {{ asset.status }}
                </span>
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{{ formatDate(asset.updatedAt) }}</td>
            </tr>
            <tr v-if="!assets.length">
              <td colspan="6" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No assets found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Showing {{ assets.length }} of {{ total }} assets
        </p>
        <div class="flex items-center gap-2">
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevrons-left" :disabled="!hasPrevPage || loading" @click="onPageChange(1)" />
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevron-left" :disabled="!hasPrevPage || loading" @click="onPageChange(page - 1)" />
          <span class="px-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Page {{ page }} / {{ totalPages }}</span>
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevron-right" :disabled="!hasNextPage || loading" @click="onPageChange(page + 1)" />
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevrons-right" :disabled="!hasNextPage || loading" @click="onPageChange(totalPages)" />
        </div>
      </div>
    </UCard>
  </section>
</template>
