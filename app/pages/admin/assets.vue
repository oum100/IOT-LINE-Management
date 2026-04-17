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

type Asset = {
  id: string
  code: string
  name: string
  kind: "WASHER" | "DRYER"
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

type ListFilters = {
  tenantId: string
  branchId: string
  q: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref("")
const filters = ref<ListFilters>({
  tenantId: "",
  branchId: "",
  q: "",
})
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const assets = ref<Asset[]>([])

const tenants = ref<Tenant[]>([])
const branches = ref<Branch[]>([])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasPrevPage = computed(() => page.value > 1)
const hasNextPage = computed(() => page.value < totalPages.value)

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
  return `${branch.code} ${branch.name}`
}

function kindLabel(kind: Asset["kind"]) {
  return kind === "WASHER" ? "Washer" : "Dryer"
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
  const branchId = typeof route.query.branchId === "string" ? route.query.branchId : ""
  const q = typeof route.query.q === "string" ? route.query.q : ""
  const pageQuery = Number(route.query.page)
  const pageSizeQuery = Number(route.query.pageSize)

  filters.value.tenantId = tenantId
  filters.value.branchId = branchId
  filters.value.q = q

  if (!Number.isNaN(pageQuery) && pageQuery > 0) page.value = pageQuery
  if (!Number.isNaN(pageSizeQuery) && pageSizeQuery > 0) pageSize.value = Math.min(50, pageSizeQuery)
}

async function loadBranches(tenantId: string) {
  if (!tenantId) {
    branches.value = []
    return
  }

  const response = await $fetch<PagingResponse<Branch>>("/api/admin/branches", {
    query: {
      tenantId,
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
    return
  }

  loading.value = true
  error.value = ""
  try {
    const response = await $fetch<PagingResponse<Asset>>("/api/admin/assets", {
      query: {
        tenantId: filters.value.tenantId,
        ...(filters.value.branchId ? { branchId: filters.value.branchId } : {}),
        ...(filters.value.q ? { q: filters.value.q } : {}),
        page: page.value,
        pageSize: pageSize.value,
      },
    })
    assets.value = response.items || []
    total.value = Number(response.total || 0)
    page.value = Number(response.page || page.value)
    pageSize.value = Number(response.pageSize || pageSize.value)
  } catch (err) {
    assets.value = []
    total.value = 0
    setError(err)
  } finally {
    loading.value = false
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
    await loadBranches(filters.value.tenantId)
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
    await loadBranches(filters.value.tenantId)
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
        <div class="grid gap-3 md:grid-cols-[1fr_260px_260px_1fr_auto] md:items-end">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Tenant</label>
            <USelect
              v-model="filters.tenantId"
              placeholder="Select tenant"
              class="w-full"
              :options="tenants.map((tenant) => ({ label: `${tenant.code} ${tenant.name}`, value: tenant.id }))"
              @update:modelValue="onTenantChange"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Branch</label>
            <USelect
              v-model="filters.branchId"
              class="w-full"
              placeholder="All branches"
              :options="[{ label: 'All branches', value: '' }, ...branches.map((branch) => ({ label: `${branch.code} ${branch.name}`, value: branch.id }))]"
              @update:modelValue="onBranchChange"
            />
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
              class="border-t border-slate-200 transition-colors duration-150 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
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
