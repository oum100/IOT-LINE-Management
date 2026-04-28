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

type RegistrationCodeItem = {
  id: string
  code: string
  status: string
  note?: string | null
  expiresAt?: string | null
  createdAt: string
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
const createOpen = ref(false)
const issueOpen = ref(false)
const issueLoading = ref(false)
const issuedCode = ref("")
const issuedCodesLoading = ref(false)
const issuedCodes = ref<RegistrationCodeItem[]>([])
const issueKind = ref<"ASSET" | "SPARE_IOT" | "SPARE_MACHINE">("ASSET")
const issueExpireDays = ref<"3" | "5" | "7">("7")
const issueExpireTime = ref("00:00")
const issueNote = ref("")
const createForm = ref({
  tenantId: "",
  branchId: "",
  assetUuid: "",
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

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasPrevPage = computed(() => page.value > 1)
const hasNextPage = computed(() => page.value < totalPages.value)
const selectedAsset = computed(() => assets.value.find(item => item.id === selectedAssetId.value) || null)
const cardSummary = computed(() => selectedSummary.value || summary.value)
const issueExpiresAtPreview = computed(() => {
  const days = Number(issueExpireDays.value || "0")
  if (!Number.isFinite(days) || days <= 0) return null
  const [hourText] = issueExpireTime.value.split(":")
  const hour = Number(hourText || "0")
  const base = new Date()
  base.setDate(base.getDate() + days)
  base.setHours(Number.isFinite(hour) ? hour : 0, 0, 0, 0)
  return base.toISOString()
})

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

async function saveAssetPatch(assetId: string, body: Record<string, unknown>) {
  loading.value = true
  error.value = ""
  try {
    await $fetch(`/api/admin/assets/${assetId}`, {
      method: "PATCH",
      body,
    })
    await loadAssets()
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
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
  loading.value = true
  error.value = ""
  try {
    const baseQuery = {
      ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
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

function onPageChange(target: number) {
  const next = Math.min(Math.max(1, target), totalPages.value)
  if (next === page.value) return
  page.value = next
  void loadAssets()
  syncRoute()
}

function randomAlphaNum(length: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]!
  }
  return out
}

function buildAssetUuid() {
  return randomAlphaNum(15)
}

function buildAssetCode() {
  return `AS-${Date.now().toString().slice(-5)}`
}

function openCreateDialog() {
  if (!filters.value.tenantId) {
    setError(new Error("Please select tenant before create asset."))
    return
  }

  const defaultBranchId =
    filters.value.branchId && branches.value.some((b) => b.id === filters.value.branchId)
      ? filters.value.branchId
      : branches.value[0]?.id || ""

  createForm.value = {
    tenantId: filters.value.tenantId,
    branchId: defaultBranchId,
    assetUuid: buildAssetUuid(),
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

function openIssueDialog() {
  if (!filters.value.tenantId) {
    setError(new Error("Please select tenant before issuing registration code."))
    return
  }
  issueKind.value = "ASSET"
  issueExpireDays.value = "7"
  issueExpireTime.value = "00:00"
  issueNote.value = ""
  issuedCode.value = ""
  issueOpen.value = true
  void loadIssuedCodes()
}

function closeIssueDialog() {
  issueOpen.value = false
}

function formatIssueDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

function isRegistrationExpired(item: RegistrationCodeItem) {
  if (item.status === "EXPIRED") return true
  if (!item.expiresAt) return false
  return new Date(item.expiresAt).getTime() < Date.now()
}

async function loadIssuedCodes() {
  if (!filters.value.tenantId) {
    issuedCodes.value = []
    return
  }
  issuedCodesLoading.value = true
  try {
    const query: Record<string, string | number> = {
      tenantId: filters.value.tenantId,
      page: 1,
      pageSize: 10
    }
    if (issueKind.value === "ASSET") {
      if (filters.value.merchantAccountId) query.merchantAccountId = filters.value.merchantAccountId
      if (filters.value.branchId) query.branchId = filters.value.branchId
    }
    const response = await $fetch<{ items: RegistrationCodeItem[] }>("/api/admin/device-registration-codes", { query })
    issuedCodes.value = response.items || []
  } catch {
    issuedCodes.value = []
  } finally {
    issuedCodesLoading.value = false
  }
}

async function issueRegistrationCode() {
  if (!filters.value.tenantId) {
    setError(new Error("Tenant is required."))
    return
  }
  if (issueKind.value === "ASSET" && !filters.value.branchId) {
    setError(new Error("Branch is required for ASSET registration code."))
    return
  }

  issueLoading.value = true
  error.value = ""
  try {
    let endpoint = "/api/admin/device-registration-codes"
    const body: Record<string, unknown> = { tenantId: filters.value.tenantId }
    const note = issueNote.value.trim()
    if (note) body.note = note
    const expiresAt = new Date(Date.now() + Number(issueExpireDays.value) * 24 * 60 * 60 * 1000).toISOString()
    body.expiresAt = expiresAt

    if (issueKind.value === "ASSET") {
      body.merchantAccountId = filters.value.merchantAccountId || null
      body.branchId = filters.value.branchId || null
    } else if (issueKind.value === "SPARE_IOT") {
      endpoint = "/api/admin/device-registration-codes/spare-iot"
    } else if (issueKind.value === "SPARE_MACHINE") {
      endpoint = "/api/admin/device-registration-codes/spare-machine"
    }

    const response = await $fetch<{ plainCode: string }>(endpoint, {
      method: "POST",
      body
    })

    issuedCode.value = response.plainCode
    await loadIssuedCodes()
  } catch (err) {
    setError(err)
  } finally {
    issueLoading.value = false
  }
}

async function deleteExpiredRegistrationCode(id: string) {
  const ok = typeof window !== "undefined" ? window.confirm("Delete this expired registration code?") : true
  if (!ok) return
  try {
    await $fetch(`/api/admin/device-registration-codes/${id}`, {
      method: "DELETE",
      body: { confirmText: "DELETE" }
    })
    await loadIssuedCodes()
  } catch (err) {
    setError(err)
  }
}

async function createAsset() {
  loading.value = true
  error.value = ""
  try {
    const payload = {
      tenantId: createForm.value.tenantId.trim(),
      branchId: createForm.value.branchId.trim(),
      assetUuid: createForm.value.assetUuid.trim(),
      code: createForm.value.code.trim(),
      name: createForm.value.name.trim(),
      kind: createForm.value.kind.trim(),
      status: createForm.value.status,
    }

    if (!payload.tenantId) throw new Error("Tenant is required.")
    if (!payload.branchId) throw new Error("Branch is required.")
    if (!payload.assetUuid) throw new Error("Asset UUID is required.")
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

watch(issueKind, () => {
  if (issueOpen.value) {
    void loadIssuedCodes()
  }
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
        <div class="grid gap-3 md:grid-cols-[1fr_220px_220px_220px_1fr_auto] md:items-end">
          <div class="flex flex-col gap-1">
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
          <div class="flex flex-col gap-1">
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
              class="w-full max-w-[320px] bg-white dark:bg-slate-950"
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
            <div class="flex items-center gap-2">
              <UButton
                color="primary"
                icon="i-lucide-plus"
                class="text-white"
                @click="openCreateDialog"
              >
                Create
              </UButton>
              <UButton
                color="success"
                icon="i-lucide-key-round"
                class="text-white"
                @click="openIssueDialog"
              >
                Register Code
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
        <table class="w-full min-w-[1100px] text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr class="text-left">
              <th class="px-3 py-2">Asset Code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Branch</th>
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
              <td class="px-3 py-2">
                <span class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {{ asset.code }}
                </span>
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <template v-if="editingNameId === asset.id">
                    <UInput
                      v-model="nameEditValue"
                      placeholder="Asset name"
                      class="w-[120px] max-w-full"
                      :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100' }"
                    />
                    <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="loading" @click.stop="saveName(asset)" />
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click.stop="cancelEditName" />
                  </template>
                  <template v-else>
                    <span>{{ asset.name }}</span>
                    <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click.stop="startEditName(asset)" />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                <div class="flex items-center gap-2">
                  <template v-if="editingKindId === asset.id">
                    <select
                      v-model="kindEditValue"
                      class="w-[120px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="WASHER">WASHER</option>
                      <option value="DRYER">DRYER</option>
                      <option value="WATER">WATER</option>
                      <option value="VENDING">VENDING</option>
                    </select>
                    <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="loading" @click.stop="saveKind(asset)" />
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click.stop="cancelEditKind" />
                  </template>
                  <template v-else>
                    <span>{{ kindLabel(asset.kind) }}</span>
                    <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click.stop="startEditKind(asset)" />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{{ branchLabel(asset.branch) }}</td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <template v-if="editingStatusId === asset.id">
                    <select
                      v-model="statusEditValue"
                      class="w-[120px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                    </select>
                    <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="loading" @click.stop="saveStatus(asset)" />
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click.stop="cancelEditStatus" />
                  </template>
                  <template v-else>
                    <span class="text-xs font-semibold" :class="assetStatusClass(asset.status)">
                      {{ asset.status }}
                    </span>
                    <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click.stop="startEditStatus(asset)" />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{{ formatDate(asset.updatedAt) }}</td>
              <td class="px-3 py-2">
                <a
                  :href="assetDetailHref(asset.id)"
                  class="inline-flex items-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title="View detail"
                  @click.stop
                >
                  <UIcon name="i-lucide-eye" class="size-4" />
                </a>
              </td>
            </tr>
            <tr v-if="!assets.length">
              <td colspan="7" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No assets found.</td>
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

    <UModal v-model:open="createOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Asset</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateDialog" />
            </div>
          </template>

          <div class="space-y-3">
            <UFormField label="Tenant">
              <select
                v-model="createForm.tenantId"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                disabled
              >
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                  {{ tenant.name }}
                </option>
              </select>
            </UFormField>

            <UFormField label="Branch">
              <select
                v-model="createForm.branchId"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select branch</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                  {{ branch.name }}
                </option>
              </select>
            </UFormField>

            <UFormField label="Asset UUID">
              <UInput v-model="createForm.assetUuid" :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100' }" />
            </UFormField>

            <UFormField label="Asset Code">
              <UInput v-model="createForm.code" :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100' }" />
            </UFormField>

            <UFormField label="Asset Name">
              <UInput v-model="createForm.name" placeholder="WM-001" :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100' }" />
            </UFormField>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Type">
                <select
                  v-model="createForm.kind"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="WASHER">WASHER</option>
                  <option value="DRYER">DRYER</option>
                  <option value="WATER">WATER</option>
                  <option value="VENDING">VENDING</option>
                </select>
              </UFormField>

              <UFormField label="Status">
                <select
                  v-model="createForm.status"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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

    <UModal v-model:open="issueOpen" :ui="{ content: 'sm:max-w-5xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Issue Registration Code</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeIssueDialog" />
            </div>
          </template>

          <div class="space-y-4">
            <div class="grid gap-3 md:grid-cols-12">
              <UFormField label="Registration Type" class="md:col-span-3">
                <select
                  v-model="issueKind"
                  class="w-full max-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="SPARE_IOT">SPARE_IOT</option>
                  <option value="SPARE_MACHINE">SPARE_MACHINE</option>
                </select>
              </UFormField>

              <UFormField label="Expire In" class="md:col-span-2">
                <select
                  v-model="issueExpireDays"
                  class="w-full max-w-[130px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="3">3 days</option>
                  <option value="5">5 days</option>
                  <option value="7">7 days</option>
                </select>
              </UFormField>

              <UFormField label="Expire Time" class="md:col-span-2">
                <select
                  v-model="issueExpireTime"
                  class="w-full max-w-[130px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option v-for="h in 24" :key="h - 1" :value="`${String(h - 1).padStart(2, '0')}:00`">
                    {{ String(h - 1).padStart(2, '0') }}:00
                  </option>
                </select>
              </UFormField>

              <UFormField label="Note (optional)" class="md:col-span-5">
                <UInput v-model="issueNote" placeholder="e.g. Installer batch #1" class="w-full" :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100' }" />
                <p class="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  Expired At: {{ formatIssueDate(issueExpiresAtPreview) }}
                </p>
              </UFormField>
            </div>

            <div class="grid gap-3 md:grid-cols-3">
              <UFormField label="Tenant">
                <UInput :model-value="tenants.find(t => t.id === filters.tenantId)?.name || '-'" readonly :ui="{ base: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' }" />
              </UFormField>

              <UFormField label="Branch">
                <UInput :model-value="issueKind === 'ASSET' ? (branches.find(b => b.id === filters.branchId)?.name || '-') : '-'" readonly :ui="{ base: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' }" />
              </UFormField>

              <UFormField label="Register Code">
                <div class="flex items-center gap-2">
                  <UInput :model-value="issuedCode || '-'" class="w-full" readonly :ui="{ base: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono' }" />
                  <CopyIconButton :value="issuedCode || ''" aria-label="Copy registration code" />
                </div>
              </UFormField>
            </div>

            <div class="rounded-lg border border-slate-200 dark:border-slate-700">
              <div class="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <span>Recent Issued Codes</span>
                <span v-if="issuedCodesLoading">Loading...</span>
              </div>
              <div class="max-h-64 overflow-auto">
                <table class="w-full text-xs">
                  <thead class="bg-slate-100/70 dark:bg-slate-800/70">
                    <tr class="text-left">
                      <th class="px-3 py-2">Code</th>
                      <th class="px-3 py-2">Status</th>
                      <th class="px-3 py-2">Note</th>
                      <th class="px-3 py-2">Expired At</th>
                      <th class="px-3 py-2">Created</th>
                      <th class="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in issuedCodes" :key="item.id" class="border-t border-slate-200 dark:border-slate-800">
                      <td class="px-3 py-2">
                        <div class="flex items-center gap-2">
                          <span class="font-mono">{{ item.code }}</span>
                          <CopyIconButton :value="item.code" aria-label="Copy registration code item" />
                        </div>
                      </td>
                      <td class="px-3 py-2">{{ item.status }}</td>
                      <td class="px-3 py-2">{{ item.note || '-' }}</td>
                      <td class="px-3 py-2">{{ item.expiresAt ? formatIssueDate(item.expiresAt) : '-' }}</td>
                      <td class="px-3 py-2">{{ formatIssueDate(item.createdAt) }}</td>
                      <td class="px-3 py-2 text-center">
                        <UButton
                          v-if="isRegistrationExpired(item)"
                          color="error"
                          variant="soft"
                          icon="i-lucide-trash-2"
                          size="xs"
                          @click="deleteExpiredRegistrationCode(item.id)"
                        />
                        <span v-else class="text-slate-400">-</span>
                      </td>
                    </tr>
                    <tr v-if="!issuedCodesLoading && issuedCodes.length === 0">
                      <td colspan="6" class="px-3 py-3 text-center text-slate-500">No issued code found</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeIssueDialog">Close</UButton>
              <UButton color="primary" class="text-white" :loading="issueLoading" @click="issueRegistrationCode">
                Issue
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
