<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({ middleware: 'portal-auth' })

type Tenant = { id: string; code: string; name: string }
type Merchant = { id: string; code: string; name: string }
type Branch = { id: string; code: string; name: string }
type AssetOption = { id: string; code: string; name: string; kind: string }

type ProductItem = {
  id: string
  tenantId: string
  code: string
  name: string
  kind: string
  amount?: number | null
  durationMinutes?: number | null
  serviceMode: 'TIME' | 'QUANTITY' | 'UNIT'
  serviceUnit: 'MINUTE' | 'SECOND' | 'LITER' | 'GRAM' | 'PIECE' | 'BOX' | 'SLOT'
  quantity?: number | null
  active: boolean
  createdAt: string
  updatedAt: string
  tenant?: Tenant | null
  _count?: {
    prices: number
    offers: number
    orderItems: number
  }
}

type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }
type ProductSummary = {
  totalCount: number
  activeCount: number
  inactiveCount: number
  washerCount: number
  dryerCount: number
  unitCount: number
  totalBindings: number
  totalSoldItems: number
}

const loading = ref(false)
const error = ref('')
const createOpen = ref(false)
const bindOpen = ref(false)
const editOpen = ref(false)
const bindingsOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const products = ref<ProductItem[]>([])
const summary = ref<ProductSummary | null>(null)

const filters = ref({
  tenantId: '',
  merchantAccountId: '',
  branchId: '',
  kind: '',
  active: '',
  q: ''
})

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])
const assets = ref<AssetOption[]>([])
const creating = ref(false)
const binding = ref(false)
const editing = ref(false)
const bindingsLoading = ref(false)

const selectedBindProduct = ref<ProductItem | null>(null)
const selectedEditProduct = ref<ProductItem | null>(null)
const bindingsProduct = ref<{ id: string; code: string; name: string } | null>(null)
const bindingRows = ref<Array<{
  id: string
  amount: number
  durationMinutes: number
  serviceMode: string
  serviceUnit: string
  quantity?: number | null
  updatedAt: string
  asset: {
    id: string
    code: string
    name: string
    branch: {
      id: string
      code: string
      name: string
      merchantAccount: {
        id: string
        code: string
        name: string
        tenant: { id: string; code: string; name: string }
      }
    }
  }
}>>([])
const bindForm = ref({
  productId: '',
  tenantId: '',
  merchantAccountId: '',
  branchId: '',
  assetId: ''
})

const createForm = ref({
  tenantId: '',
  name: '',
  kind: 'WASHER',
  amount: 0,
  durationMinutes: 0,
  serviceMode: 'TIME' as 'TIME' | 'QUANTITY' | 'UNIT',
  serviceUnit: 'MINUTE' as 'MINUTE' | 'SECOND' | 'LITER' | 'GRAM' | 'PIECE' | 'BOX' | 'SLOT',
  quantity: 1,
  active: true
})
const editForm = ref({
  name: '',
  kind: 'WASHER',
  amount: 0,
  durationMinutes: 0,
  serviceMode: 'TIME' as 'TIME' | 'QUANTITY' | 'UNIT',
  serviceUnit: 'MINUTE' as 'MINUTE' | 'SECOND' | 'LITER' | 'GRAM' | 'PIECE' | 'BOX' | 'SLOT',
  quantity: 1,
  active: true
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const bindableProducts = computed(() =>
  products.value.filter(item => item.active && (item._count?.prices || 0) === 0)
)

function setError(err: unknown) {
  const fetchErr = err as { data?: { statusMessage?: string }; message?: string } | undefined
  error.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Request failed'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function modeLabel(item: ProductItem) {
  if (item.serviceMode === 'TIME') return `${item.durationMinutes || 0} min`
  const qty = item.quantity == null ? 1 : Number(item.quantity)
  const unit = item.serviceUnit.toLowerCase()
  return `${qty} ${unit}`
}

function amountLabel(item: ProductItem) {
  return `${item.amount || 0}`
}

function statusClass(active: boolean) {
  return active ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
}

function serviceBindingLabel(item: { serviceMode: string; durationMinutes: number; serviceUnit: string; quantity?: number | null }) {
  if (item.serviceMode === 'TIME') return `${item.durationMinutes} min`
  const qty = item.quantity == null ? 1 : Number(item.quantity)
  return `${qty} ${String(item.serviceUnit || '').toLowerCase()}`
}

function openCreate() {
  createForm.value.tenantId = filters.value.tenantId || tenants.value[0]?.id || ''
  createForm.value.name = ''
  createForm.value.kind = 'WASHER'
  createForm.value.amount = 0
  createForm.value.durationMinutes = 0
  createForm.value.serviceMode = 'TIME'
  createForm.value.serviceUnit = 'MINUTE'
  createForm.value.quantity = 1
  createForm.value.active = true
  createOpen.value = true
}

async function createProduct() {
  creating.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/products', {
      method: 'POST',
      body: {
        ...createForm.value,
        quantity: createForm.value.serviceMode === 'TIME' ? null : createForm.value.quantity
      }
    })
    createOpen.value = false
    await loadProducts()
  } catch (err) {
    setError(err)
  } finally {
    creating.value = false
  }
}

async function openBind(item: ProductItem) {
  selectedBindProduct.value = item
  bindForm.value.productId = item.id
  bindForm.value.tenantId = item.tenantId || filters.value.tenantId || ''
  bindForm.value.merchantAccountId = ''
  bindForm.value.branchId = ''
  bindForm.value.assetId = ''
  bindOpen.value = true
  await loadMerchants(bindForm.value.tenantId)
  assets.value = []
}

async function openBindGlobal() {
  selectedBindProduct.value = null
  bindForm.value.productId = ''
  bindForm.value.tenantId = filters.value.tenantId || tenants.value[0]?.id || ''
  bindForm.value.merchantAccountId = ''
  bindForm.value.branchId = ''
  bindForm.value.assetId = ''
  bindOpen.value = true
  await loadMerchants(bindForm.value.tenantId)
  assets.value = []
}

async function submitBind() {
  const targetProductId = selectedBindProduct.value?.id || bindForm.value.productId
  if (!targetProductId) return
  binding.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${targetProductId}/bind`, {
      method: 'POST',
      body: {
        tenantId: bindForm.value.tenantId,
        merchantAccountId: bindForm.value.merchantAccountId,
        branchId: bindForm.value.branchId,
        assetId: bindForm.value.assetId
      }
    })
    bindOpen.value = false
    selectedBindProduct.value = null
    assets.value = []
    await loadProducts()
  } catch (err) {
    setError(err)
  } finally {
    binding.value = false
  }
}

function openEdit(item: ProductItem) {
  selectedEditProduct.value = item
  editForm.value.name = item.name
  editForm.value.kind = item.kind
  editForm.value.amount = Number(item.amount || 0)
  editForm.value.durationMinutes = Number(item.durationMinutes || 0)
  editForm.value.serviceMode = item.serviceMode
  editForm.value.serviceUnit = item.serviceUnit
  editForm.value.quantity = Number(item.quantity ?? 1)
  editForm.value.active = item.active
  editOpen.value = true
}

async function submitEdit() {
  if (!selectedEditProduct.value) return
  editing.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${selectedEditProduct.value.id}`, {
      method: 'PATCH',
      body: {
        ...editForm.value,
        quantity: editForm.value.serviceMode === 'TIME' ? null : editForm.value.quantity
      }
    })
    editOpen.value = false
    selectedEditProduct.value = null
    await loadProducts()
  } catch (err) {
    setError(err)
  } finally {
    editing.value = false
  }
}

async function openBindings(item: ProductItem) {
  bindingsOpen.value = true
  bindingsLoading.value = true
  bindingsProduct.value = { id: item.id, code: item.code, name: item.name }
  bindingRows.value = []
  try {
    const response = await $fetch<{ prices: typeof bindingRows.value }>(`/api/admin/products/${item.id}/bindings`)
    bindingRows.value = response.prices || []
  } catch (err) {
    setError(err)
  } finally {
    bindingsLoading.value = false
  }
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>('/api/admin/tenants', { query: { page: 1, pageSize: 200 } })
  tenants.value = response.items || []
}

async function loadMerchants(tenantId: string) {
  if (!tenantId) {
    merchants.value = []
    return
  }
  const response = await $fetch<PagingResponse<Merchant>>('/api/admin/merchants', {
    query: { tenantId, page: 1, pageSize: 200 }
  })
  merchants.value = response.items || []
}

async function loadBranches(tenantId: string, merchantAccountId = '') {
  if (!tenantId) {
    branches.value = []
    return
  }
  const response = await $fetch<PagingResponse<Branch>>('/api/admin/branches', {
    query: {
      tenantId,
      ...(merchantAccountId ? { merchantAccountId } : {}),
      page: 1,
      pageSize: 200
    }
  })
  branches.value = response.items || []
}

async function loadAssetsByScope(tenantId: string, merchantAccountId: string, branchId: string) {
  if (!tenantId || !merchantAccountId || !branchId) {
    assets.value = []
    return
  }
  const response = await $fetch<PagingResponse<AssetOption>>('/api/admin/assets', {
    query: {
      tenantId,
      merchantAccountId,
      branchId,
      page: 1,
      pageSize: 200
    }
  })
  const kind = selectedBindProduct.value?.kind || ''
  assets.value = (response.items || []).filter(item => (kind ? item.kind === kind : true))
}

async function loadProducts() {
  loading.value = true
  error.value = ''
  try {
    const queryBase = {
      ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      ...(filters.value.branchId ? { branchId: filters.value.branchId } : {}),
      ...(filters.value.kind ? { kind: filters.value.kind } : {}),
      ...(filters.value.active ? { active: filters.value.active } : {})
    }

    const [listResponse, summaryResponse] = await Promise.all([
      $fetch<PagingResponse<ProductItem>>('/api/admin/products', {
        query: {
          ...queryBase,
          ...(filters.value.q.trim() ? { q: filters.value.q.trim() } : {}),
          page: page.value,
          pageSize: pageSize.value
        }
      }),
      $fetch<ProductSummary>('/api/admin/products/summary', { query: queryBase })
    ])

    products.value = listResponse.items || []
    total.value = Number(listResponse.total || 0)
    summary.value = summaryResponse
  } catch (err) {
    products.value = []
    total.value = 0
    summary.value = null
    setError(err)
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadProducts()
}

watch(
  () => filters.value.tenantId,
  async () => {
    filters.value.merchantAccountId = ''
    filters.value.branchId = ''
    await Promise.all([loadMerchants(filters.value.tenantId), loadBranches(filters.value.tenantId)])
    applyFilters()
  }
)

watch(
  () => filters.value.merchantAccountId,
  async () => {
    filters.value.branchId = ''
    await loadBranches(filters.value.tenantId, filters.value.merchantAccountId)
    applyFilters()
  }
)

watch(() => filters.value.branchId, () => applyFilters())
watch(() => filters.value.kind, () => applyFilters())
watch(() => filters.value.active, () => applyFilters())

watch(() => bindForm.value.merchantAccountId, async () => {
  bindForm.value.branchId = ''
  bindForm.value.assetId = ''
  await loadBranches(bindForm.value.tenantId, bindForm.value.merchantAccountId)
  assets.value = []
})

watch(() => bindForm.value.branchId, async () => {
  bindForm.value.assetId = ''
  await loadAssetsByScope(bindForm.value.tenantId, bindForm.value.merchantAccountId, bindForm.value.branchId)
})

onMounted(async () => {
  await loadTenants()
  await loadProducts()
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Product Management</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">View and search products by tenant/merchant/branch</p>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-[220px_220px_220px_180px_180px_1fr] md:items-end">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Tenant</label>
            <select v-model="filters.tenantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All tenants</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Merchant</label>
            <select v-model="filters.merchantAccountId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All merchants</option>
              <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">{{ merchant.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Branch</label>
            <select v-model="filters.branchId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All branches</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Type</label>
            <select v-model="filters.kind" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All types</option>
              <option value="WASHER">Washer</option>
              <option value="DRYER">Dryer</option>
              <option value="WATER">Water</option>
              <option value="VENDING">Vending</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Status</label>
            <select v-model="filters.active" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All status</option>
              <option value="true">ACTIVE</option>
              <option value="false">INACTIVE</option>
            </select>
          </div>
          <SearchInput
            v-model="filters.q"
            placeholder="Search code/name/product id..."
            @enter="applyFilters"
          />
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <UCard :ui="{ root: 'bg-emerald-50/70 dark:bg-emerald-950/25 ring-1 ring-emerald-200 dark:ring-emerald-700/40' }"><p class="text-xs text-emerald-700 dark:text-emerald-300">Total</p><p class="text-2xl font-bold text-emerald-700 dark:text-emerald-200">{{ summary?.totalCount || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Active</p><p class="text-2xl font-bold text-emerald-500">{{ summary?.activeCount || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Inactive</p><p class="text-2xl font-bold text-rose-500">{{ summary?.inactiveCount || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Washer</p><p class="text-2xl font-bold text-blue-500">{{ summary?.washerCount || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Dryer</p><p class="text-2xl font-bold text-violet-500">{{ summary?.dryerCount || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Asset Bindings</p><p class="text-2xl font-bold text-cyan-500">{{ summary?.totalBindings || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Sold Items</p><p class="text-2xl font-bold text-amber-500">{{ summary?.totalSoldItems || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Service Unit</p><p class="text-2xl font-bold text-slate-500">{{ summary?.unitCount || 0 }}</p></UCard>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Product List</p>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-plus" color="primary" class="text-white" @click="openCreate">Create</UButton>
          <UButton icon="i-lucide-link" color="primary" class="text-white" @click="openBindGlobal">Bind</UButton>
        </div>
      </div>

      <div class="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-200 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <tr>
              <th class="px-3 py-2">Code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Price</th>
              <th class="px-3 py-2">Service</th>
              <th class="px-3 py-2 text-center">Status</th>
              <th class="px-3 py-2 text-center">Bindings</th>
              <th class="px-3 py-2 text-center">Orders</th>
              <th class="px-3 py-2">Updated</th>
              <th class="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in products" :key="item.id" class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
              <td class="px-3 py-2 font-medium">{{ item.code }}</td>
              <td class="px-3 py-2">{{ item.name }}</td>
              <td class="px-3 py-2">{{ item.kind }}</td>
              <td class="px-3 py-2">{{ amountLabel(item) }}</td>
              <td class="px-3 py-2">{{ modeLabel(item) }}</td>
              <td class="px-3 py-2 text-center"><span :class="statusClass(item.active)">{{ item.active ? 'ACTIVE' : 'INACTIVE' }}</span></td>
              <td class="px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <span>{{ item._count?.prices || 0 }}</span>
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-list" @click="openBindings(item)" />
                </div>
              </td>
              <td class="px-3 py-2 text-center">{{ item._count?.orderItems || 0 }}</td>
              <td class="px-3 py-2">{{ formatDate(item.updatedAt) }}</td>
              <td class="px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click="openEdit(item)" />
                  <UButton
                    size="xs"
                    :color="(item._count?.prices || 0) > 0 ? 'warning' : 'primary'"
                    variant="soft"
                    :icon="(item._count?.prices || 0) > 0 ? 'i-lucide-unlink' : 'i-lucide-link'"
                    @click="openBind(item)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!loading && products.length === 0">
              <td colspan="10" class="px-3 py-6 text-center text-slate-500">No products found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between text-sm">
        <p class="text-slate-500 dark:text-slate-400">Showing {{ products.length }} of {{ total }} products</p>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-chevron-left" color="neutral" variant="soft" :disabled="page <= 1" @click="page -= 1; loadProducts()" />
          <span class="text-xs text-slate-500 dark:text-slate-400">Page {{ page }} / {{ totalPages }}</span>
          <UButton icon="i-lucide-chevron-right" color="neutral" variant="soft" :disabled="page >= totalPages" @click="page += 1; loadProducts()" />
        </div>
      </div>
    </UCard>

    <UModal v-model:open="createOpen" :ui="{ content: 'sm:max-w-3xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Create Product</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="createOpen = false" />
            </div>
          </template>

          <div class="grid gap-3 md:grid-cols-2">
            <UFormField label="Tenant">
              <select v-model="createForm.tenantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="" disabled>Select tenant</option>
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
              </select>
            </UFormField>
            <UFormField label="Name">
              <UInput v-model="createForm.name" :ui="{ base: 'h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Type">
              <select v-model="createForm.kind" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="WASHER">WASHER</option>
                <option value="DRYER">DRYER</option>
                <option value="WATER">WATER</option>
                <option value="VENDING">VENDING</option>
              </select>
            </UFormField>
            <UFormField label="Status">
              <select v-model="createForm.active" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option :value="true">ACTIVE</option>
                <option :value="false">INACTIVE</option>
              </select>
            </UFormField>
            <UFormField label="Service Mode">
              <select v-model="createForm.serviceMode" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="TIME">TIME</option>
                <option value="QUANTITY">QUANTITY</option>
                <option value="UNIT">UNIT</option>
              </select>
            </UFormField>
            <UFormField label="Service Unit">
              <select v-model="createForm.serviceUnit" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="MINUTE">MINUTE</option>
                <option value="SECOND">SECOND</option>
                <option value="LITER">LITER</option>
                <option value="GRAM">GRAM</option>
                <option value="PIECE">PIECE</option>
                <option value="BOX">BOX</option>
                <option value="SLOT">SLOT</option>
              </select>
            </UFormField>
            <UFormField label="Price">
              <UInput v-model.number="createForm.amount" type="number" :ui="{ base: 'h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Duration (min)">
              <UInput v-model.number="createForm.durationMinutes" type="number" :disabled="createForm.serviceMode !== 'TIME'" :ui="{ base: 'h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Quantity">
              <UInput v-model.number="createForm.quantity" type="number" :disabled="createForm.serviceMode === 'TIME'" :ui="{ base: 'h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="createOpen = false">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="creating" @click="createProduct">Create</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="bindOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Bind Product</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="bindOpen = false" />
            </div>
          </template>

          <div class="grid gap-3 md:grid-cols-2">
            <UFormField label="Tenant">
              <select v-model="bindForm.tenantId" disabled class="h-10 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
              </select>
            </UFormField>
            <UFormField label="Product">
              <template v-if="selectedBindProduct">
                <UInput :model-value="`${selectedBindProduct.name} (${selectedBindProduct.code})`" disabled :ui="{ base: 'h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-1 ring-slate-300 dark:ring-slate-600' }" />
              </template>
              <template v-else>
                <select v-model="bindForm.productId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                  <option value="" disabled>Select product</option>
                  <option v-for="item in bindableProducts" :key="item.id" :value="item.id">{{ item.name }} ({{ item.code }})</option>
                </select>
              </template>
            </UFormField>
            <UFormField label="Merchant">
              <select v-model="bindForm.merchantAccountId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="" disabled>Select merchant</option>
                <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">{{ merchant.name }}</option>
              </select>
            </UFormField>
            <UFormField label="Branch">
              <select v-model="bindForm.branchId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="" disabled>Select branch</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
              </select>
            </UFormField>
            <UFormField label="Asset" class="md:col-span-2">
              <select v-model="bindForm.assetId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="" disabled>Select asset</option>
                <option v-for="asset in assets" :key="asset.id" :value="asset.id">{{ asset.name }} ({{ asset.code }})</option>
              </select>
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="bindOpen = false">Cancel</UButton>
              <UButton color="primary" class="text-white" icon="i-lucide-link" :loading="binding" :disabled="!(selectedBindProduct?.id || bindForm.productId) || !bindForm.assetId || !bindForm.branchId || !bindForm.merchantAccountId" @click="submitBind">Bind</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="editOpen" :ui="{ content: 'sm:max-w-3xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Product</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="editOpen = false" />
            </div>
          </template>

          <div class="grid gap-3 md:grid-cols-2">
            <UFormField label="Name">
              <UInput v-model="editForm.name" :ui="{ base: 'h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Type">
              <select v-model="editForm.kind" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="WASHER">WASHER</option>
                <option value="DRYER">DRYER</option>
                <option value="WATER">WATER</option>
                <option value="VENDING">VENDING</option>
              </select>
            </UFormField>
            <UFormField label="Status">
              <select v-model="editForm.active" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option :value="true">ACTIVE</option>
                <option :value="false">INACTIVE</option>
              </select>
            </UFormField>
            <UFormField label="Service Mode">
              <select v-model="editForm.serviceMode" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="TIME">TIME</option>
                <option value="QUANTITY">QUANTITY</option>
                <option value="UNIT">UNIT</option>
              </select>
            </UFormField>
            <UFormField label="Service Unit">
              <select v-model="editForm.serviceUnit" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="MINUTE">MINUTE</option>
                <option value="SECOND">SECOND</option>
                <option value="LITER">LITER</option>
                <option value="GRAM">GRAM</option>
                <option value="PIECE">PIECE</option>
                <option value="BOX">BOX</option>
                <option value="SLOT">SLOT</option>
              </select>
            </UFormField>
            <UFormField label="Price">
              <UInput v-model.number="editForm.amount" type="number" :ui="{ base: 'h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Duration (min)">
              <UInput v-model.number="editForm.durationMinutes" type="number" :disabled="editForm.serviceMode !== 'TIME'" :ui="{ base: 'h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Quantity">
              <UInput v-model.number="editForm.quantity" type="number" :disabled="editForm.serviceMode === 'TIME'" :ui="{ base: 'h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="editOpen = false">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="editing" @click="submitEdit">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="bindingsOpen" :ui="{ content: 'sm:max-w-5xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Bind List{{ bindingsProduct ? ` - ${bindingsProduct.name} (${bindingsProduct.code})` : '' }}</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="bindingsOpen = false" />
            </div>
          </template>

          <div v-if="bindingsLoading" class="py-8 text-center text-sm text-slate-500">Loading...</div>
          <div v-else class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-200 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <tr>
                  <th class="px-3 py-2">Tenant</th>
                  <th class="px-3 py-2">Merchant</th>
                  <th class="px-3 py-2">Branch</th>
                  <th class="px-3 py-2">Asset</th>
                  <th class="px-3 py-2">Price</th>
                  <th class="px-3 py-2">Service</th>
                  <th class="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in bindingRows" :key="row.id" class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                  <td class="px-3 py-2">{{ row.asset.branch.merchantAccount.tenant.name }}</td>
                  <td class="px-3 py-2">{{ row.asset.branch.merchantAccount.name }}</td>
                  <td class="px-3 py-2">{{ row.asset.branch.name }}</td>
                  <td class="px-3 py-2">{{ row.asset.name }} ({{ row.asset.code }})</td>
                  <td class="px-3 py-2">{{ row.amount }}</td>
                  <td class="px-3 py-2">{{ serviceBindingLabel(row) }}</td>
                  <td class="px-3 py-2">{{ formatDate(row.updatedAt) }}</td>
                </tr>
                <tr v-if="!bindingRows.length">
                  <td colspan="7" class="px-3 py-6 text-center text-slate-500">No bind records</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
