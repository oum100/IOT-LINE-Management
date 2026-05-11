<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ProductBindModal from '~/components/asset/ProductBindModal.vue'
import ProductUnbindModal from '~/components/asset/ProductUnbindModal.vue'

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
  serviceMode: string
  serviceUnit: string
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
  unitCount: number
  totalBindings: number
  totalSoldItems: number
  productTypeCounts: Array<{ code: string; name: string; count: number }>
}

const loading = ref(false)
const error = ref('')
const createOpen = ref(false)
const bindOpen = ref(false)
const editOpen = ref(false)
const bindingsOpen = ref(false)
const taxonomyOpen = ref(false)
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
const taxonomy = ref<{
  productTypes: Array<{ code: string; name: string }>
  serviceModes: Array<{ code: string; name: string }>
  serviceUnits: Array<{ code: string; name: string; symbol?: string | null }>
}>({ productTypes: [], serviceModes: [], serviceUnits: [] })
const creating = ref(false)
const binding = ref(false)
const editing = ref(false)
const bindingsLoading = ref(false)
const taxonomySaving = ref(false)
const taxonomyError = ref('')

const serviceModeRows = ref<Array<{ code: string; name: string; sortOrder: number; active: boolean }>>([])
const serviceUnitRows = ref<Array<{ code: string; name: string; symbol: string | null; sortOrder: number; active: boolean }>>([])
const productTypeRows = ref<Array<{ code: string; name: string; sortOrder: number; active: boolean }>>([])
const typeDraft = ref({ code: '', name: '', sortOrder: 100, active: true })
const modeDraft = ref({ code: '', name: '', sortOrder: 100, active: true })
const unitDraft = ref({ code: '', name: '', symbol: '', sortOrder: 100, active: true })

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
  assetIds: [] as string[]
})
const bindingTargetRow = ref<(typeof bindingRows.value)[number] | null>(null)
const unbindOpen = ref(false)
const unbinding = ref(false)
const unbindError = ref('')

const createForm = ref({
  tenantId: '',
  name: '',
  kind: '',
  amount: 0,
  durationMinutes: 0,
  serviceMode: 'TIME',
  serviceUnit: 'MINUTE',
  quantity: 1,
  active: true
})
const editForm = ref({
  name: '',
  kind: '',
  amount: 0,
  durationMinutes: 0,
  serviceMode: 'TIME',
  serviceUnit: 'MINUTE',
  quantity: 1,
  active: true
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const bindableProducts = computed(() =>
  products.value.filter(item => item.active)
)

function setError(err: unknown) {
  const fetchErr = err as { data?: { statusMessage?: string }; message?: string } | undefined
  error.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Request failed'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function modeLabel(item: ProductItem) {
  if (item.serviceMode === 'TIME') return `${item.durationMinutes || 0}`
  const qty = item.quantity == null ? 1 : Number(item.quantity)
  const unit = unitLabel(item.serviceUnit)
  return `${qty} ${unit}`
}

function amountLabel(item: ProductItem) {
  return `${item.amount || 0}`
}

function priceUnitLabel() {
  return 'THB'
}

const productTypeOptions = computed(() => taxonomy.value.productTypes)
const serviceModeOptions = computed(() => taxonomy.value.serviceModes)
const serviceUnitOptions = computed(() => taxonomy.value.serviceUnits)
const summaryProductTypeCounts = computed(() => summary.value?.productTypeCounts || [])

function statusClass(active: boolean) {
  return active ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
}

function serviceBindingLabel(item: { serviceMode: string; durationMinutes: number; serviceUnit: string; quantity?: number | null }) {
  if (item.serviceMode === 'TIME') return `${item.durationMinutes}`
  const qty = item.quantity == null ? 1 : Number(item.quantity)
  return `${qty} ${unitLabel(String(item.serviceUnit || ''))}`
}

function modeName(code: string) {
  return serviceModeOptions.value.find(item => item.code === code)?.name || code
}

function unitLabel(code: string) {
  const found = serviceUnitOptions.value.find(item => item.code === code)
  if (!found) return code
  return found.symbol ? `${found.name} (${found.symbol})` : found.name
}

function openCreate() {
  createForm.value.tenantId = filters.value.tenantId || tenants.value[0]?.id || ''
  createForm.value.name = ''
  createForm.value.kind = productTypeOptions.value[0]?.code || ''
  createForm.value.amount = 0
  createForm.value.durationMinutes = 0
  createForm.value.serviceMode = serviceModeOptions.value[0]?.code || 'TIME'
  createForm.value.serviceUnit = serviceUnitOptions.value[0]?.code || 'MINUTE'
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
  selectedBindProduct.value = null
  bindForm.value.productId = item.id
  bindForm.value.tenantId = item.tenantId || filters.value.tenantId || tenants.value[0]?.id || ''
  bindForm.value.merchantAccountId = filters.value.merchantAccountId || ''
  bindForm.value.branchId = filters.value.branchId || ''
  bindForm.value.assetIds = []
  bindOpen.value = true
  await loadMerchants(bindForm.value.tenantId)
  await loadBranches(bindForm.value.tenantId, bindForm.value.merchantAccountId)
  await loadAssetsByScope(bindForm.value.tenantId, bindForm.value.merchantAccountId, bindForm.value.branchId)
}

async function openBindGlobal() {
  selectedBindProduct.value = null
  bindForm.value.productId = ''
  bindForm.value.tenantId = filters.value.tenantId || tenants.value[0]?.id || ''
  bindForm.value.merchantAccountId = filters.value.merchantAccountId || ''
  bindForm.value.branchId = filters.value.branchId || ''
  bindForm.value.assetIds = []
  bindOpen.value = true
  await loadMerchants(bindForm.value.tenantId)
  await loadBranches(bindForm.value.tenantId, bindForm.value.merchantAccountId)
  await loadAssetsByScope(bindForm.value.tenantId, bindForm.value.merchantAccountId, bindForm.value.branchId)
}

async function submitBind() {
  const targetProductId = bindForm.value.productId
  if (!targetProductId || !bindForm.value.assetIds.length) return
  binding.value = true
  error.value = ''
  try {
    for (const assetId of bindForm.value.assetIds) {
      await $fetch(`/api/admin/products/${targetProductId}/bind`, {
        method: 'POST',
        body: {
          tenantId: bindForm.value.tenantId,
          merchantAccountId: bindForm.value.merchantAccountId,
          branchId: bindForm.value.branchId,
          assetId
        }
      })
    }
    bindOpen.value = false
    selectedBindProduct.value = null
    bindForm.value.assetIds = []
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

function openUnbindRow(row: (typeof bindingRows.value)[number]) {
  bindingTargetRow.value = row
  unbindError.value = ''
  unbindOpen.value = true
}

async function submitUnbindRow() {
  if (!bindingTargetRow.value) return
  unbinding.value = true
  unbindError.value = ''
  try {
    await $fetch(`/api/admin/assets/${bindingTargetRow.value.asset.id}/products/${bindingsProduct.value?.id}`, { method: 'DELETE' })
    unbindOpen.value = false
    if (bindingsProduct.value?.id) {
      const response = await $fetch<{ prices: typeof bindingRows.value }>(`/api/admin/products/${bindingsProduct.value.id}/bindings`)
      bindingRows.value = response.prices || []
    }
    await loadProducts()
  } catch (err: any) {
    unbindError.value = err?.data?.statusMessage || err?.message || 'Failed to unbind product'
  } finally {
    unbinding.value = false
  }
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>('/api/admin/tenants', { query: { page: 1, pageSize: 200 } })
  tenants.value = response.items || []
}

async function loadTaxonomy() {
  const response = await $fetch<{
    productTypes: Array<{ code: string; name: string }>
    serviceModes: Array<{ code: string; name: string }>
    serviceUnits: Array<{ code: string; name: string; symbol?: string | null }>
  }>('/api/admin/products/taxonomy')
  taxonomy.value = response
}

async function loadTaxonomyTables() {
  const [types, modes, units] = await Promise.all([
    $fetch<{ items: Array<{ code: string; name: string; sortOrder: number; active: boolean }> }>('/api/admin/product-types'),
    $fetch<{ items: Array<{ code: string; name: string; sortOrder: number; active: boolean }> }>('/api/admin/service-modes'),
    $fetch<{ items: Array<{ code: string; name: string; symbol: string | null; sortOrder: number; active: boolean }> }>('/api/admin/service-units')
  ])
  productTypeRows.value = types.items || []
  serviceModeRows.value = modes.items || []
  serviceUnitRows.value = units.items || []
}

async function openTaxonomyManager() {
  taxonomyError.value = ''
  await loadTaxonomyTables()
  taxonomyOpen.value = true
}

async function createMode() {
  taxonomySaving.value = true
  taxonomyError.value = ''
  try {
    await $fetch('/api/admin/service-modes', { method: 'POST', body: modeDraft.value })
    modeDraft.value = { code: '', name: '', sortOrder: 100, active: true }
    await Promise.all([loadTaxonomy(), loadTaxonomyTables()])
  } catch (err: any) {
    taxonomyError.value = err?.data?.statusMessage || err?.message || 'Failed to create service mode'
  } finally {
    taxonomySaving.value = false
  }
}

async function createType() {
  taxonomySaving.value = true
  taxonomyError.value = ''
  try {
    await $fetch('/api/admin/product-types', { method: 'POST', body: typeDraft.value })
    typeDraft.value = { code: '', name: '', sortOrder: 100, active: true }
    await Promise.all([loadTaxonomy(), loadTaxonomyTables()])
  } catch (err: any) {
    taxonomyError.value = err?.data?.statusMessage || err?.message || 'Failed to create product type'
  } finally {
    taxonomySaving.value = false
  }
}

async function createUnit() {
  taxonomySaving.value = true
  taxonomyError.value = ''
  try {
    await $fetch('/api/admin/service-units', { method: 'POST', body: { ...unitDraft.value, symbol: unitDraft.value.symbol || null } })
    unitDraft.value = { code: '', name: '', symbol: '', sortOrder: 100, active: true }
    await Promise.all([loadTaxonomy(), loadTaxonomyTables()])
  } catch (err: any) {
    taxonomyError.value = err?.data?.statusMessage || err?.message || 'Failed to create service unit'
  } finally {
    taxonomySaving.value = false
  }
}

async function updateType(item: { code: string; name: string; sortOrder: number; active: boolean }) {
  taxonomySaving.value = true
  taxonomyError.value = ''
  try {
    await $fetch(`/api/admin/product-types/${encodeURIComponent(item.code)}`, { method: 'PATCH', body: item })
    await Promise.all([loadTaxonomy(), loadTaxonomyTables()])
  } catch (err: any) {
    taxonomyError.value = err?.data?.statusMessage || err?.message || 'Failed to update product type'
  } finally {
    taxonomySaving.value = false
  }
}

async function updateMode(item: { code: string; name: string; sortOrder: number; active: boolean }) {
  taxonomySaving.value = true
  taxonomyError.value = ''
  try {
    await $fetch(`/api/admin/service-modes/${encodeURIComponent(item.code)}`, { method: 'PATCH', body: item })
    await Promise.all([loadTaxonomy(), loadTaxonomyTables()])
  } catch (err: any) {
    taxonomyError.value = err?.data?.statusMessage || err?.message || 'Failed to update service mode'
  } finally {
    taxonomySaving.value = false
  }
}

async function updateUnit(item: { code: string; name: string; symbol: string | null; sortOrder: number; active: boolean }) {
  taxonomySaving.value = true
  taxonomyError.value = ''
  try {
    await $fetch(`/api/admin/service-units/${encodeURIComponent(item.code)}`, { method: 'PATCH', body: item })
    await Promise.all([loadTaxonomy(), loadTaxonomyTables()])
  } catch (err: any) {
    taxonomyError.value = err?.data?.statusMessage || err?.message || 'Failed to update service unit'
  } finally {
    taxonomySaving.value = false
  }
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
  const selected = products.value.find(item => item.id === bindForm.value.productId) || null
  const kind = selected?.kind || ''
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
  bindForm.value.assetIds = []
  await loadBranches(bindForm.value.tenantId, bindForm.value.merchantAccountId)
  assets.value = []
})

watch(() => bindForm.value.tenantId, async () => {
  bindForm.value.merchantAccountId = ''
  bindForm.value.branchId = ''
  bindForm.value.assetIds = []
  await loadMerchants(bindForm.value.tenantId)
  branches.value = []
  assets.value = []
})

watch(() => bindForm.value.branchId, async () => {
  bindForm.value.assetIds = []
  await loadAssetsByScope(bindForm.value.tenantId, bindForm.value.merchantAccountId, bindForm.value.branchId)
})

onMounted(async () => {
  await loadTaxonomy()
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
              <option v-for="option in productTypeOptions" :key="option.code" :value="option.code">{{ option.name }} ({{ option.code }})</option>
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
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Asset Bindings</p><p class="text-2xl font-bold text-cyan-500">{{ summary?.totalBindings || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Sold Items</p><p class="text-2xl font-bold text-amber-500">{{ summary?.totalSoldItems || 0 }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Service Unit</p><p class="text-2xl font-bold text-slate-500">{{ summary?.unitCount || 0 }}</p></UCard>
        <UCard
          v-for="typeCount in summaryProductTypeCounts"
          :key="`summary-type-${typeCount.code}`"
          :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"
        >
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ typeCount.name }}</p>
          <p class="text-2xl font-bold text-blue-500">{{ typeCount.count }}</p>
        </UCard>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Product List</p>
        <div class="flex items-center gap-2">
          <NuxtLink to="/admin/product-types">
            <UButton icon="i-lucide-tags" color="neutral" variant="soft">Product Taxonomy</UButton>
          </NuxtLink>
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
              <th class="px-3 py-2 text-center">Price</th>
              <th class="px-3 py-2 text-center">Currency</th>
              <th class="px-3 py-2 text-center">Service</th>
              <th class="px-3 py-2 text-center">Service Mode</th>
              <th class="px-3 py-2 text-center">Service Unit</th>
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
              <td class="px-3 py-2">{{ productTypeOptions.find(row => row.code === item.kind)?.name || item.kind }}</td>
              <td class="px-3 py-2 text-center">{{ amountLabel(item) }}</td>
              <td class="px-3 py-2 text-center">{{ priceUnitLabel() }}</td>
              <td class="px-3 py-2 text-center">{{ modeLabel(item) }}</td>
              <td class="px-3 py-2 text-center">{{ modeName(item.serviceMode) }}</td>
              <td class="px-3 py-2 text-center">{{ unitLabel(item.serviceUnit) }}</td>
              <td class="px-3 py-2 text-center"><span :class="statusClass(item.active)">{{ item.active ? 'ACTIVE' : 'INACTIVE' }}</span></td>
              <td class="px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <span>{{ item._count?.prices || 0 }}</span>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-list"
                    title="View Bind List"
                    @click="openBindings(item)"
                  />
                </div>
              </td>
              <td class="px-3 py-2 text-center">{{ item._count?.orderItems || 0 }}</td>
              <td class="px-3 py-2"><DateTimeTwoLine :value="item.updatedAt" /></td>
              <td class="px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-pencil"
                    title="Edit Product"
                    @click="openEdit(item)"
                  />
                  <UButton
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-link"
                    title="Bind Product"
                    @click="openBind(item)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!loading && products.length === 0">
              <td colspan="13" class="px-3 py-6 text-center text-slate-500">No products found</td>
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

          <div class="grid gap-3 md:grid-cols-6">
            <UFormField label="Product Code" class="w-full md:col-span-3">
              <UInput
                model-value="Auto generated after create"
                disabled
                class="w-full"
                :ui="{ base: 'w-full h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-1 ring-slate-300 dark:ring-slate-600' }"
              />
            </UFormField>
            <UFormField label="Product Name" class="w-full md:col-span-3">
              <UInput v-model="createForm.name" class="w-full" :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Tenant" class="md:col-span-2">
              <select v-model="createForm.tenantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="" disabled>Select tenant</option>
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
              </select>
            </UFormField>
            <UFormField label="Type" class="md:col-span-2">
              <select v-model="createForm.kind" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option v-for="option in productTypeOptions" :key="option.code" :value="option.code">{{ option.name }} ({{ option.code }})</option>
              </select>
            </UFormField>
            <UFormField label="Status" class="md:col-span-2">
              <select v-model="createForm.active" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option :value="true">ACTIVE</option>
                <option :value="false">INACTIVE</option>
              </select>
            </UFormField>
            <UFormField label="Service Mode" class="md:col-span-3">
              <select v-model="createForm.serviceMode" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option v-for="option in serviceModeOptions" :key="option.code" :value="option.code">{{ option.name }} ({{ option.code }})</option>
              </select>
            </UFormField>
            <UFormField label="Service Unit" class="md:col-span-3">
              <select v-model="createForm.serviceUnit" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option v-for="option in serviceUnitOptions" :key="option.code" :value="option.code">{{ option.name }} ({{ option.code }})</option>
              </select>
            </UFormField>
            <UFormField label="Price" class="md:col-span-2">
              <UInput v-model.number="createForm.amount" type="number" class="w-full" :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Duration (min)" class="md:col-span-2">
              <UInput v-model.number="createForm.durationMinutes" type="number" class="w-full" :disabled="createForm.serviceMode !== 'TIME'" :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Quantity" class="md:col-span-2">
              <UInput v-model.number="createForm.quantity" type="number" class="w-full" :disabled="createForm.serviceMode === 'TIME'" :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
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

    <UModal v-model:open="editOpen" :ui="{ content: 'sm:max-w-3xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Product</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="editOpen = false" />
            </div>
          </template>

          <div class="grid gap-3 md:grid-cols-6">
            <UFormField label="Product Code" class="w-full md:col-span-3">
              <UInput
                :model-value="selectedEditProduct?.code || '-'"
                disabled
                class="w-full"
                :ui="{ base: 'w-full h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-1 ring-slate-300 dark:ring-slate-600' }"
              />
            </UFormField>
            <UFormField label="Product Name" class="w-full md:col-span-3">
              <UInput v-model="editForm.name" class="w-full" :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Type" class="md:col-span-3">
              <select v-model="editForm.kind" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option v-for="option in productTypeOptions" :key="option.code" :value="option.code">{{ option.name }} ({{ option.code }})</option>
              </select>
            </UFormField>
            <UFormField label="Status" class="md:col-span-3">
              <select v-model="editForm.active" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option :value="true">ACTIVE</option>
                <option :value="false">INACTIVE</option>
              </select>
            </UFormField>
            <UFormField label="Service Mode" class="md:col-span-3">
              <select v-model="editForm.serviceMode" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option v-for="option in serviceModeOptions" :key="option.code" :value="option.code">{{ option.name }} ({{ option.code }})</option>
              </select>
            </UFormField>
            <UFormField label="Service Unit" class="md:col-span-3">
              <select v-model="editForm.serviceUnit" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option v-for="option in serviceUnitOptions" :key="option.code" :value="option.code">{{ option.name }} ({{ option.code }})</option>
              </select>
            </UFormField>
            <UFormField label="Price" class="md:col-span-2">
              <UInput v-model.number="editForm.amount" type="number" class="w-full" :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Duration (min)" class="md:col-span-2">
              <UInput v-model.number="editForm.durationMinutes" type="number" class="w-full" :disabled="editForm.serviceMode !== 'TIME'" :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
            </UFormField>
            <UFormField label="Quantity" class="md:col-span-2">
              <UInput v-model.number="editForm.quantity" type="number" class="w-full" :disabled="editForm.serviceMode === 'TIME'" :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }" />
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
                  <th class="px-3 py-2 text-center">Action</th>
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
                  <td class="px-3 py-2"><DateTimeTwoLine :value="row.updatedAt" /></td>
                  <td class="px-3 py-2 text-center">
                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-lucide-unlink"
                      title="Unbind Product"
                      @click="openUnbindRow(row)"
                    />
                  </td>
                </tr>
                <tr v-if="!bindingRows.length">
                  <td colspan="8" class="px-3 py-6 text-center text-slate-500">No bind records</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </template>
    </UModal>

    <ProductBindModal
      v-model:open="bindOpen"
      v-model="bindForm.productId"
      :loading="binding"
      :error="error"
      :options="bindableProducts as any"
      :tenants="tenants as any"
      :merchants="merchants as any"
      :branches="branches as any"
      :assets="assets as any"
      :tenant-id="bindForm.tenantId"
      :merchant-account-id="bindForm.merchantAccountId"
      :branch-id="bindForm.branchId"
      :asset-ids="bindForm.assetIds"
      @update:tenant-id="bindForm.tenantId = $event"
      @update:merchant-account-id="bindForm.merchantAccountId = $event"
      @update:branch-id="bindForm.branchId = $event"
      @update:asset-ids="bindForm.assetIds = $event"
      @submit="submitBind"
    />

    <ProductUnbindModal
      v-model:open="unbindOpen"
      :loading="unbinding"
      :error="unbindError"
      :asset-name="bindingTargetRow?.asset?.name || ''"
      :asset-code="bindingTargetRow?.asset?.code || ''"
      :product-name="bindingsProduct?.name || ''"
      :product-code="bindingsProduct?.code || ''"
      @confirm="submitUnbindRow"
    />

  </section>
</template>
