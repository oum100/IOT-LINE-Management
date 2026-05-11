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
  merchantAccountId?: string | null
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
  tenant?: {
    id: string
    code: string
    name: string
  } | null
  branch?: {
    id: string
    code: string
    name: string
    merchantAccount?: {
      id: string
      code: string
      name: string
    } | null
  } | null
  iot?: {
    id: string
    name?: string | null
    deviceUid?: string | null
    macAddress?: string | null
  } | null
  machine?: {
    id: string
    name?: string | null
    serialNo: string
    model?: string | null
  } | null
  products?: Array<{
    id: string
    code: string
    name: string
  }>
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
  assetType: string
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
  assetType: "",
  q: "",
})
const page = ref(1)
const pageSize = ref(25)
const total = ref(0)
const assets = ref<Asset[]>([])
const summary = ref<AssetSummary | null>(null)
const selectedAssetId = ref("")
const selectedSummary = ref<AssetSummary | null>(null)
const summaryError = ref("")
const summaryLoading = ref(false)
const createOpen = ref(false)
const editOpen = ref(false)
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteTarget = ref<Asset | null>(null)
const deleteConfirmText = ref("")
const iotBindingOpen = ref(false)
const iotBindingAssetId = ref("")
const iotBindingAssetName = ref("")
const machineBindingOpen = ref(false)
const machineBindingAssetId = ref("")
const machineBindingAssetName = ref("")
const productPromoOpen = ref(false)
const productPromoAssetId = ref("")
const productPromoAssetName = ref("")
const createForm = ref({
  tenantId: "",
  merchantAccountId: "",
  branchId: "",
  code: "",
  name: "",
  kind: "WASHER",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "MAINTENANCE",
})
const editingNameId = ref("")
const nameEditValue = ref("")
const editingKindId = ref("")
const kindEditValue = ref("WASHER")
const editingStatusId = ref("")
const statusEditValue = ref<"ACTIVE" | "INACTIVE" | "MAINTENANCE">("ACTIVE")
const editingAssetId = ref("")
const editForm = ref({
  name: "",
  kind: "WASHER",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "MAINTENANCE",
})

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasPrevPage = computed(() => page.value > 1)
const hasNextPage = computed(() => page.value < totalPages.value)
const selectedAsset = computed(() => assets.value.find(item => item.id === selectedAssetId.value) || null)
const cardSummary = computed(() => selectedSummary.value || summary.value)

function setError(err: unknown) {
  const fetchErr = err as { data?: { statusMessage?: string }; message?: string } | undefined
  const statusMessage = fetchErr?.data?.statusMessage
  error.value = statusMessage || (err instanceof Error ? err.message : "Request failed")
}

function resetPage() {
  page.value = 1
}

function assetStatusClass(status: Asset["status"]) {
  if (status === "ACTIVE") return "text-emerald-600 dark:text-emerald-400"
  if (status === "INACTIVE") return "text-rose-600 dark:text-rose-400"
  return "text-amber-600 dark:text-amber-400"
}

function assetReadiness(asset: Asset) {
  const hasDevice = Boolean(asset.iot?.id)
  const hasMachine = Boolean(asset.machine?.id)
  const hasProduct = (asset.products?.length || 0) > 0
  if (!hasDevice) return "MISSING_DEVICE"
  if (!hasMachine) return "MISSING_MACHINE"
  if (!hasProduct) return "MISSING_PRODUCT"
  return "READY"
}

function assetReadinessLabel(asset: Asset) {
  const readiness = assetReadiness(asset)
  if (readiness === "MISSING_DEVICE") return "Missing device"
  if (readiness === "MISSING_MACHINE") return "Missing machine"
  if (readiness === "MISSING_PRODUCT") return "Missing product"
  return "Ready"
}

function assetReadinessClass(asset: Asset) {
  const readiness = assetReadiness(asset)
  if (readiness === "READY") return "text-emerald-600 dark:text-emerald-400"
  if (readiness === "MISSING_DEVICE" || readiness === "MISSING_MACHINE") return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function branchLabel(branch?: Asset["branch"] | null) {
  if (!branch) return "-"
  return branch.name
}

function tenantLabel(tenant?: Asset["tenant"] | null) {
  if (!tenant) return "-"
  return tenant.name || tenant.code || "-"
}

function merchantLabel(asset: Asset) {
  return asset.branch?.merchantAccount?.name || asset.branch?.merchantAccount?.code || "-"
}

function kindLabel(kind: Asset["kind"]) {
  if (!kind) return "-"
  return kind.charAt(0) + kind.slice(1).toLowerCase()
}

function iotLabel(asset: Asset) {
  return asset.iot?.deviceUid || "-"
}

function machineLabel(asset: Asset) {
  return asset.machine?.name || "-"
}

function productNames(asset: Asset) {
  return (asset.products || [])
    .map(item => item.name || item.code)
    .filter(Boolean)
}

function openProductPromo(asset: Asset) {
  productPromoAssetId.value = asset.id
  productPromoAssetName.value = asset.name
  productPromoOpen.value = true
}

function openIotBindingModal(asset: Asset) {
  iotBindingAssetId.value = asset.id
  iotBindingAssetName.value = asset.name
  iotBindingOpen.value = true
}

function openMachineBindingModal(asset: Asset) {
  machineBindingAssetId.value = asset.id
  machineBindingAssetName.value = asset.name
  machineBindingOpen.value = true
}

async function onIotBindingChanged() {
  await loadData()
}

async function onMachineBindingChanged() {
  await loadData()
}

async function onProductPromoChanged() {
  await loadData()
}

function startEditName(item: Asset) {
  editingNameId.value = item.id
  nameEditValue.value = item.name
}

function cancelEditName() {
  editingNameId.value = ""
  nameEditValue.value = ""
}

function startEditKind(item: Asset) {
  editingKindId.value = item.id
  kindEditValue.value = item.kind
}

function cancelEditKind() {
  editingKindId.value = ""
}

function startEditStatus(item: Asset) {
  editingStatusId.value = item.id
  statusEditValue.value = item.status
}

function cancelEditStatus() {
  editingStatusId.value = ""
}

function startEditAsset(item: Asset) {
  editingAssetId.value = item.id
  editForm.value.name = item.name
  editForm.value.kind = item.kind
  editForm.value.status = item.status
  editOpen.value = true
}

function closeEditDialog() {
  editOpen.value = false
  editingAssetId.value = ""
}

async function submitEditDialog() {
  if (!editingAssetId.value) return
  const name = editForm.value.name.trim()
  if (!name) {
    setError(new Error("Asset name is required."))
    return
  }
  await saveAssetPatch(editingAssetId.value, {
    name,
    kind: editForm.value.kind,
    status: editForm.value.status,
  })
  closeEditDialog()
}

async function saveAssetPatch(assetId: string, body: Record<string, unknown>) {
  loading.value = true
  error.value = ""
  try {
    await $fetch(`/api/admin/assets/${assetId}`, {
      method: "patch",
      body,
    } as any)
    await loadAssets()
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

function openDeleteDialog(item: Asset) {
  deleteTarget.value = item
  deleteConfirmText.value = ""
  deleteOpen.value = true
}

function closeDeleteDialog() {
  deleteOpen.value = false
  deleteTarget.value = null
  deleteConfirmText.value = ""
}

async function confirmDeleteAsset() {
  if (!deleteTarget.value) return
  deleting.value = true
  error.value = ""
  try {
    await $fetch(`/api/admin/assets/${deleteTarget.value.id}`, {
      method: "delete",
      body: {
        confirmText: deleteConfirmText.value,
        confirmName: deleteTarget.value.name,
      },
    } as any)

    if (selectedAssetId.value === deleteTarget.value.id) {
      selectedAssetId.value = ""
      selectedSummary.value = null
    }
    closeDeleteDialog()
    await loadAssets()
  } catch (err) {
    setError(err)
  } finally {
    deleting.value = false
  }
}

async function saveName(item: Asset) {
  const name = nameEditValue.value.trim()
  if (!name) {
    setError(new Error("Asset name is required."))
    return
  }
  await saveAssetPatch(item.id, { name })
  cancelEditName()
}

async function saveKind(item: Asset) {
  const kind = kindEditValue.value.trim().toUpperCase()
  if (!kind) {
    setError(new Error("Asset type is required."))
    return
  }
  await saveAssetPatch(item.id, { kind })
  cancelEditKind()
}

async function saveStatus(item: Asset) {
  await saveAssetPatch(item.id, { status: statusEditValue.value })
  cancelEditStatus()
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
  const assetType = typeof route.query.assetType === "string" ? route.query.assetType : ""
  const q = typeof route.query.q === "string" ? route.query.q : ""
  const pageQuery = Number(route.query.page)
  const pageSizeQuery = Number(route.query.pageSize)

  filters.value.tenantId = tenantId
  filters.value.merchantAccountId = merchantAccountId
  filters.value.branchId = branchId
  filters.value.assetType = assetType
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
  loading.value = true
  error.value = ""
  try {
    const baseQuery = {
      ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      ...(filters.value.branchId ? { branchId: filters.value.branchId } : {}),
      ...(filters.value.assetType ? { assetType: filters.value.assetType } : {}),
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

function openAssetDetail(assetId: string) {
  if (!assetId) return
  const query: Record<string, string> = {}
  if (filters.value.tenantId) query.tenantId = filters.value.tenantId
  if (filters.value.merchantAccountId) query.merchantAccountId = filters.value.merchantAccountId
  if (filters.value.branchId) query.branchId = filters.value.branchId
  void navigateTo({
    path: `/admin/asset-detail/${assetId}`,
    query
  })
}

function assetDetailHref(assetId: string) {
  const query = new URLSearchParams()
  if (filters.value.tenantId) query.set("tenantId", filters.value.tenantId)
  if (filters.value.merchantAccountId) query.set("merchantAccountId", filters.value.merchantAccountId)
  if (filters.value.branchId) query.set("branchId", filters.value.branchId)
  const queryString = query.toString()
  return queryString
    ? `/admin/asset-detail/${assetId}?${queryString}`
    : `/admin/asset-detail/${assetId}`
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
    page: page.value,
    pageSize: pageSize.value,
  }
  if (filters.value.tenantId) {
    query.tenantId = filters.value.tenantId
  }
  if (filters.value.branchId) {
    query.branchId = filters.value.branchId
  }
  if (filters.value.assetType) {
    query.assetType = filters.value.assetType
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

function onAssetTypeChange() {
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

function buildAssetCode() {
  return `AS-${Date.now().toString().slice(-5)}`
}

function openCreateDialog() {
  if (!filters.value.tenantId) {
    setError(new Error("Please select tenant before create asset."))
    return
  }

  const defaultMerchantId =
    filters.value.merchantAccountId && merchants.value.some((m) => m.id === filters.value.merchantAccountId)
      ? filters.value.merchantAccountId
      : merchants.value[0]?.id || ""

  const branchOptions = branches.value.filter((b) => !defaultMerchantId || b.merchantAccountId === defaultMerchantId)
  const defaultBranchId =
    filters.value.branchId && branchOptions.some((b) => b.id === filters.value.branchId)
      ? filters.value.branchId
      : branchOptions[0]?.id || ""

  createForm.value = {
    tenantId: filters.value.tenantId,
    merchantAccountId: defaultMerchantId,
    branchId: defaultBranchId,
    code: buildAssetCode(),
    name: "",
    kind: "WASHER",
    status: "ACTIVE",
  }
  createOpen.value = true
}

function closeCreateDialog() {
  createOpen.value = false
}

function onCreateMerchantChange() {
  const scopedBranches = branches.value.filter((b) => !createForm.value.merchantAccountId || b.merchantAccountId === createForm.value.merchantAccountId)
  if (!scopedBranches.some((b) => b.id === createForm.value.branchId)) {
    createForm.value.branchId = scopedBranches[0]?.id || ""
  }
}

async function createAsset() {
  loading.value = true
  error.value = ""
  try {
    const payload = {
      tenantId: createForm.value.tenantId.trim(),
      branchId: createForm.value.branchId.trim(),
      code: createForm.value.code.trim(),
      name: createForm.value.name.trim(),
      kind: createForm.value.kind.trim(),
      status: createForm.value.status,
    }

    if (!payload.tenantId) throw new Error("Tenant is required.")
    if (!createForm.value.merchantAccountId.trim()) throw new Error("Merchant is required.")
    if (!payload.branchId) throw new Error("Branch is required.")
    if (!payload.code) throw new Error("Asset code is required.")
    if (!payload.name) throw new Error("Asset name is required.")

    await $fetch("/api/admin/assets", {
      method: "POST",
      body: payload,
    })

    closeCreateDialog()
    await loadAssets()
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
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
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Asset Management</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          View and search assets by tenant/branch
        </p>
      </div>
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

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-[220px_220px_220px_220px_1fr_auto] md:items-end">
          <div class="flex w-full flex-col gap-1 md:w-[220px]">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Tenant</label>
            <select
              v-model="filters.tenantId"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              @change="onTenantChange"
            >
              <option value="">All tenants</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                {{ tenant.name }}
              </option>
            </select>
          </div>
          <div class="flex w-full flex-col gap-1 md:w-[220px]">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Merchant (Brand)</label>
            <select
              v-model="filters.merchantAccountId"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              @change="onMerchantChange"
            >
              <option value="">All merchant (brand)</option>
              <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">
                {{ merchant.name }}
              </option>
            </select>
          </div>
          <div class="flex w-full flex-col gap-1 md:w-[220px]">
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
          <div class="flex w-full flex-col gap-1 md:w-[220px]">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Asset Type</label>
            <select
              v-model="filters.assetType"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              @change="onAssetTypeChange"
            >
              <option value="">All types</option>
              <option value="WASHER">WASHER</option>
              <option value="DRYER">DRYER</option>
            </select>
          </div>
          <div class="flex items-end gap-2">
            <SearchInput
              v-model="filters.q"
              placeholder="Search code/name/asset uuid..."
              class="w-full max-w-[320px]"
              @enter="onSearch"
            />
          </div>
          <div class="flex justify-end">
            <div class="flex flex-nowrap items-center gap-2 whitespace-nowrap">
              <UButton
                color="primary"
                icon="i-lucide-plus"
                class="text-white"
                @click="openCreateDialog"
              >
                Create
              </UButton>
            </div>
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
        <table class="w-full min-w-[1500px] text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr class="text-center">
              <th class="px-3 py-2">Asset Code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Tenant</th>
              <th class="px-3 py-2">Merchant</th>
              <th class="px-3 py-2">Branch</th>
              <th class="px-3 py-2">IoT</th>
              <th class="px-3 py-2">Machine</th>
              <th class="px-3 py-2">Product</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Updated</th>
              <th class="px-3 py-2">Actions</th>
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
              <td class="px-3 py-2 text-center">
                <span class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {{ asset.code }}
                </span>
              </td>
              <td class="px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-2">
                  <span>{{ asset.name }}</span>
                </div>
              </td>
              <td class="px-3 py-2 text-center text-xs text-slate-700 dark:text-slate-300">
                <div class="flex items-center justify-center gap-2">
                  <span>{{ kindLabel(asset.kind) }}</span>
                </div>
              </td>
              <td class="px-3 py-2 text-center text-xs text-slate-700 dark:text-slate-300">{{ tenantLabel(asset.tenant) }}</td>
              <td class="px-3 py-2 text-center text-xs text-slate-700 dark:text-slate-300">{{ merchantLabel(asset) }}</td>
              <td class="px-3 py-2 text-center text-xs text-slate-700 dark:text-slate-300">{{ branchLabel(asset.branch) }}</td>
              <td class="px-3 py-2 text-center text-xs text-slate-700 dark:text-slate-300">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                  title="Bind/Replace IoT"
                  @click.stop="openIotBindingModal(asset)"
                >
                  {{ iotLabel(asset) }}
                </button>
              </td>
              <td class="px-3 py-2 text-center text-xs text-slate-700 dark:text-slate-300">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                  title="Bind/Replace Machine"
                  @click.stop="openMachineBindingModal(asset)"
                >
                  {{ machineLabel(asset) }}
                </button>
              </td>
              <td class="px-3 py-2 text-center text-xs text-slate-700 dark:text-slate-300">
                <template v-if="productNames(asset).length">
                  <div class="group relative inline-block">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                      title="Open product promo"
                      @click.stop="openProductPromo(asset)"
                    >
                      {{ productNames(asset)[0] }}
                      <span v-if="productNames(asset).length > 1" class="ml-1 text-slate-500 dark:text-slate-300">+{{ productNames(asset).length - 1 }}</span>
                    </button>
                    <div class="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-900">
                      <p class="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Products</p>
                      <ul class="space-y-1">
                        <li v-for="(name, idx) in productNames(asset)" :key="`${asset.id}-hover-product-${idx}`" class="text-xs text-slate-700 dark:text-slate-200">
                          {{ name }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </template>
                <template v-else>-</template>
              </td>
              <td class="px-3 py-2 text-center">
                <div class="leading-tight text-center">
                  <p class="text-sm font-semibold" :class="assetStatusClass(asset.status)">{{ asset.status }}</p>
                  <p class="text-sm font-medium" :class="assetReadinessClass(asset)">{{ assetReadinessLabel(asset) }}</p>
                </div>
              </td>
              <td class="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-300"><DateTimeTwoLine :value="asset.updatedAt" /></td>
              <td class="px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-2">
                  <a
                    :href="assetDetailHref(asset.id)"
                    class="inline-flex items-center p-1 text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
                    title="Edit asset"
                    @click.stop
                  >
                    <UIcon name="i-lucide-pencil" class="size-4" />
                  </a>
                  <button
                    type="button"
                    class="inline-flex items-center p-1 text-rose-500 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Delete asset"
                    :disabled="loading"
                    @click.stop="openDeleteDialog(asset)"
                  >
                    <UIcon name="i-lucide-trash-2" class="size-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!assets.length">
              <td colspan="12" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No assets found.</td>
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

    <UModal v-model:open="editOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Asset</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeEditDialog" />
            </div>
          </template>
          <div class="grid gap-3 md:grid-cols-3">
            <UFormField label="Name">
              <UInput
                v-model="editForm.name"
                placeholder="Asset name"
                :ui="{ base: 'h-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600' }"
              />
            </UFormField>
            <UFormField label="Type">
              <select
                v-model="editForm.kind"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="WASHER">WASHER</option>
                <option value="DRYER">DRYER</option>
                <option value="WATER">WATER</option>
                <option value="VENDING">VENDING</option>
              </select>
            </UFormField>
            <UFormField label="Status">
              <select
                v-model="editForm.status"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeEditDialog">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="loading" @click="submitEditDialog">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete Asset</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeDeleteDialog" />
            </div>
          </template>
          <div class="space-y-3">
            <p class="text-sm text-slate-700 dark:text-slate-200">
              This action cannot be undone. Please confirm the asset below before delete.
            </p>
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <p class="text-sm text-slate-700 dark:text-slate-200">
                <span class="font-semibold text-slate-900 dark:text-slate-100">Asset:</span>
                <span class="ml-2 font-semibold text-slate-900 dark:text-slate-100">{{ deleteTarget?.name || '-' }}</span>
                <span class="ml-1 text-slate-500 dark:text-slate-400">({{ deleteTarget?.code || '-' }})</span>
              </p>
            </div>
            <UFormField label="Type DELETE to confirm">
              <UInput
                v-model="deleteConfirmText"
                class="w-full"
                placeholder="DELETE"
                :ui="{ base: 'w-full h-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-500' }"
              />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeDeleteDialog">Cancel</UButton>
              <UButton
                color="error"
                class="text-white"
                :loading="deleting"
                :disabled="deleteConfirmText !== 'DELETE'"
                @click="confirmDeleteAsset"
              >
                Delete
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="createOpen" :ui="{ content: 'sm:max-w-4xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Asset</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateDialog" />
            </div>
          </template>

          <div class="space-y-3">
            <div class="grid gap-3 sm:grid-cols-3">
              <UFormField>
                <template #label><span>Tenant <span class="text-rose-500">*</span></span></template>
                <select
                  v-model="createForm.tenantId"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                  disabled
                >
                  <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                    {{ tenant.name }}
                  </option>
                </select>
              </UFormField>

              <UFormField>
                <template #label><span>Merchant <span class="text-rose-500">*</span></span></template>
                <select
                  v-model="createForm.merchantAccountId"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                  @change="onCreateMerchantChange"
                >
                  <option value="">Select merchant</option>
                  <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">
                    {{ merchant.name }}
                  </option>
                </select>
              </UFormField>

              <UFormField>
                <template #label><span>Branch <span class="text-rose-500">*</span></span></template>
                <select
                  v-model="createForm.branchId"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select branch</option>
                  <option v-for="branch in branches.filter((b) => !createForm.merchantAccountId || b.merchantAccountId === createForm.merchantAccountId)" :key="branch.id" :value="branch.id">
                    {{ branch.name }}
                  </option>
                </select>
              </UFormField>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label><span>Asset Code <span class="text-rose-500">*</span></span></template>
                <UInput v-model="createForm.code" class="w-full" readonly :ui="{ root: 'w-full', base: 'h-10 w-full bg-slate-100 text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" />
              </UFormField>

              <UFormField>
                <template #label><span>Asset Name <span class="text-rose-500">*</span></span></template>
                <UInput v-model="createForm.name" class="w-full" placeholder="WM-001" :ui="{ root: 'w-full', base: 'h-10 w-full bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label><span>Type <span class="text-rose-500">*</span></span></template>
                <select
                  v-model="createForm.kind"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="WASHER">WASHER</option>
                  <option value="DRYER">DRYER</option>
                  <option value="WATER">WATER</option>
                  <option value="VENDING">VENDING</option>
                </select>
              </UFormField>

              <UFormField>
                <template #label><span>Status <span class="text-rose-500">*</span></span></template>
                <select
                  v-model="createForm.status"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </UFormField>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" class="text-slate-700 dark:text-slate-100" @click="closeCreateDialog">
                Cancel
              </UButton>
              <UButton color="primary" class="text-white" :loading="loading" @click="createAsset">
                Create Asset
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <AssetIotBindingModal
      v-model:open="iotBindingOpen"
      :asset-id="iotBindingAssetId"
      :asset-name="iotBindingAssetName"
      @changed="onIotBindingChanged"
    />

    <AssetMachineBindingModal
      v-model:open="machineBindingOpen"
      :asset-id="machineBindingAssetId"
      :asset-name="machineBindingAssetName"
      @changed="onMachineBindingChanged"
    />

    <AssetProductPromoModal
      v-model:open="productPromoOpen"
      :asset-id="productPromoAssetId"
      :asset-name="productPromoAssetName"
      @changed="onProductPromoChanged"
    />

  </section>
</template>
