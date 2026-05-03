<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"

definePageMeta({
  middleware: "portal-auth",
})

type BranchStatus = "ACTIVE" | "SUSPENDED" | "DISABLED"
type Tenant = {
  id: string
  code: string
  name: string
}

type MerchantOption = {
  id: string
  code: string
  name: string
}

type BranchRecord = {
  id: string
  tenantId: string
  merchantAccountId?: string | null
  merchantAccount?: MerchantOption | null
  code: string
  name: string
  status: BranchStatus
  metadata?: Record<string, any> | null
  createdAt?: string
  updatedAt?: string
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

type PagingResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const route = useRoute()

const loading = ref(false)
const message = ref("")
const error = ref("")
const query = ref("")
const selectedTenantFilter = ref("")
const selectedMerchantFilter = ref("")
const tenants = ref<Tenant[]>([])
const merchants = ref<MerchantOption[]>([])
const branches = ref<BranchRecord[]>([])
const selectedBranchId = ref("")
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const summaryLoading = ref(false)
const summaryError = ref("")
const branchSummary = ref<BranchSummary | null>(null)

const createOpen = ref(false)
const createForm = ref({
  tenantId: "",
  merchantAccountId: "",
  code: "",
  name: "",
  status: "ACTIVE" as BranchStatus,
})

const editingNameId = ref("")
const nameEditValue = ref("")
const editingStatusId = ref("")
const statusEditValue = ref<BranchStatus>("ACTIVE")

const metadataOpen = ref(false)
const metadataTitle = ref("")
const metadataBranchId = ref("")
const metadataRaw = ref("")

const inputUi = {
  base: "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600",
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasPrevPage = computed(() => page.value > 1)
const hasNextPage = computed(() => page.value < totalPages.value)
const selectedBranch = computed(() => branches.value.find(item => item.id === selectedBranchId.value) || null)

function readTenantId(): string {
  const raw = route.query.tenantId
  return typeof raw === "string" ? raw.trim() : ""
}

function readMerchantId(): string {
  const raw = route.query.merchantAccountId
  return typeof raw === "string" ? raw.trim() : ""
}

function setMessage(text: string) {
  message.value = text
  error.value = ""
}

function setError(err: unknown) {
  const fetchErr = err as { data?: { statusMessage?: string }; message?: string } | undefined
  const statusMessage = fetchErr?.data?.statusMessage
  message.value = ""
  error.value = statusMessage || (err instanceof Error ? err.message : "Request failed")
}

async function run(task: () => Promise<void>) {
  loading.value = true
  try {
    await task()
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

function formatDate(value?: string) {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

function formatMetadata(value: unknown) {
  if (!value) return ""
  const raw = JSON.stringify(value)
  return raw.length > 80 ? `${raw.slice(0, 80)}...` : raw
}

function branchStatusClass(status: BranchStatus) {
  if (status === "ACTIVE") return "text-emerald-600 dark:text-emerald-400"
  if (status === "SUSPENDED") return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

async function loadTenants() {
  try {
    const collected: Tenant[] = []
    let nextPage = 1
    const maxPages = 20
    const perPage = 200

    while (nextPage <= maxPages) {
      const response = await $fetch<{ items: Tenant[] }>("/api/admin/tenants", {
        query: { page: nextPage, pageSize: perPage },
      })
      const items = response.items || []
      collected.push(...items)
      if (items.length < perPage) break
      nextPage += 1
    }

    tenants.value = collected
  } catch (err) {
    tenants.value = []
    setError(err)
  }
}

async function loadMerchantsByTenant(tenantId: string) {
  try {
    const response = await $fetch<{ items: MerchantOption[] }>("/api/admin/merchants", {
      query: {
        ...(tenantId ? { tenantId } : {}),
        page: 1,
        pageSize: 200,
      },
    })
    merchants.value = response.items || []
  } catch {
    merchants.value = []
  }
}

function tenantLabel(tenantId?: string | null) {
  if (!tenantId) return "-"
  const tenant = tenants.value.find(item => item.id === tenantId)
  return tenant ? tenant.name : "-"
}

function merchantLabel(merchantId?: string | null) {
  if (!merchantId) return "-"
  const merchant = merchants.value.find(item => item.id === merchantId)
  if (merchant) return merchant.name
  const linked = branches.value.find(item => item.merchantAccountId === merchantId)?.merchantAccount
  return linked ? linked.name : "-"
}

async function loadBranches(resetPage = false) {
  await run(async () => {
    if (resetPage) page.value = 1

    const response = await $fetch<PagingResponse<BranchRecord>>("/api/admin/branches", {
      query: {
        ...(selectedTenantFilter.value ? { tenantId: selectedTenantFilter.value } : {}),
        ...(selectedMerchantFilter.value ? { merchantAccountId: selectedMerchantFilter.value } : {}),
        ...(query.value ? { q: query.value } : {}),
        page: page.value,
        pageSize: pageSize.value,
      },
    })

    branches.value = response.items || []
    total.value = Number(response.total || 0)
    page.value = Number(response.page || page.value)
    pageSize.value = Number(response.pageSize || pageSize.value)

    const stillExists = branches.value.some(item => item.id === selectedBranchId.value)
    if (!stillExists) {
      selectedBranchId.value = branches.value[0]?.id || ""
    }
  })
}

async function loadBranchSummary(branchId: string) {
  summaryLoading.value = true
  summaryError.value = ""
  try {
    branchSummary.value = await $fetch<BranchSummary>(`/api/admin/branches/${branchId}/summary`)
  } catch (err) {
    branchSummary.value = null
    summaryError.value = err instanceof Error ? err.message : "Failed to load branch summary"
  } finally {
    summaryLoading.value = false
  }
}

function selectBranch(item: BranchRecord) {
  selectedBranchId.value = item.id
}

async function onTenantFilterChange() {
  selectedMerchantFilter.value = ""
  await loadMerchantsByTenant(selectedTenantFilter.value)
  await loadBranches(true)
}

async function onMerchantFilterChange() {
  await loadBranches(true)
}

async function onSearch() {
  page.value = 1
  await loadBranches()
}

async function suggestNextBranchCode(tenantId: string) {
  const response = await $fetch<{ items: BranchRecord[] }>("/api/admin/branches", {
    query: {
      tenantId,
      page: 1,
      pageSize: 200,
    },
  })
  const list = response.items || []
  const maxCodeNumber = list.reduce((max, branch) => {
    const match = branch.code?.match(/(\d+)$/)
    if (!match) return max
    return Math.max(max, Number(match[1]))
  }, 0)
  return `BR-${String(maxCodeNumber + 1).padStart(5, "0")}`
}

function refreshBranches() {
  void loadBranches()
  if (selectedBranchId.value) {
    void loadBranchSummary(selectedBranchId.value)
  }
}

async function goToPage(target: number) {
  const next = Math.min(Math.max(1, target), totalPages.value)
  if (next === page.value) return
  page.value = next
  await loadBranches()
}

async function openCreateDialog() {
  await run(async () => {
    const tenantId = selectedTenantFilter.value || tenants.value[0]?.id || ""
    if (!tenantId) throw new Error("No tenant available.")

    const merchantId = selectedMerchantFilter.value || ""
    await loadMerchantsByTenant(tenantId)

    createForm.value = {
      tenantId,
      merchantAccountId: merchantId,
      code: await suggestNextBranchCode(tenantId),
      name: "",
      status: "ACTIVE",
    }
    createOpen.value = true
  })
}

function closeCreateDialog() {
  createOpen.value = false
}

function onCreateTenantChange() {
  void (async () => {
    createForm.value.merchantAccountId = ""
    await loadMerchantsByTenant(createForm.value.tenantId)
    createForm.value.code = await suggestNextBranchCode(createForm.value.tenantId)
  })()
}

async function createBranch() {
  await run(async () => {
    const tenantId = (createForm.value.tenantId || "").trim()
    const code = (createForm.value.code || "").trim()
    const name = (createForm.value.name || "").trim()
    const merchantAccountId = (createForm.value.merchantAccountId || "").trim()

    if (!tenantId) throw new Error("Tenant is required.")
    if (!code) throw new Error("Branch code is required.")
    if (!name) throw new Error("Branch name is required.")

    await $fetch("/api/admin/branches", {
      method: "POST",
      body: {
        tenantId,
        merchantAccountId: merchantAccountId || null,
        code,
        name,
        status: createForm.value.status,
      },
    })

    setMessage(`Branch created: ${code}`)
    closeCreateDialog()
    selectedTenantFilter.value = tenantId
    selectedMerchantFilter.value = merchantAccountId
    await loadMerchantsByTenant(selectedTenantFilter.value)
    await loadBranches()
  })
}

function startEditName(item: BranchRecord) {
  editingNameId.value = item.id
  nameEditValue.value = item.name
}

function cancelEditName() {
  editingNameId.value = ""
  nameEditValue.value = ""
}

async function saveName(item: BranchRecord) {
  await run(async () => {
    const name = (nameEditValue.value || "").trim()
    if (!name) throw new Error("Branch name is required.")

    await $fetch(`/api/admin/branches/${item.id}`, {
      method: "PATCH",
      body: { name },
    })

    setMessage(`Branch name updated: ${item.code}`)
    cancelEditName()
    await loadBranches()
  })
}

function startEditStatus(item: BranchRecord) {
  editingStatusId.value = item.id
  statusEditValue.value = item.status
}

function cancelEditStatus() {
  editingStatusId.value = ""
}

async function saveStatus(item: BranchRecord) {
  await run(async () => {
    await $fetch(`/api/admin/branches/${item.id}`, {
      method: "PATCH",
      body: { status: statusEditValue.value },
    })

    setMessage(`Branch status updated: ${item.code}`)
    cancelEditStatus()
    await loadBranches()
  })
}

function openMetadata(item: BranchRecord) {
  metadataTitle.value = `${item.code} details`
  metadataBranchId.value = item.id
  metadataRaw.value = item.metadata ? JSON.stringify(item.metadata, null, 2) : "{}"
  metadataOpen.value = true
}

async function saveMetadata() {
  await run(async () => {
    if (!metadataBranchId.value) throw new Error("Missing branch id.")
    let parsed: Record<string, any> | null = null
    const raw = metadataRaw.value.trim()
    if (raw) {
      parsed = JSON.parse(raw)
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Details must be a JSON object.")
      }
    }

    await $fetch(`/api/admin/branches/${metadataBranchId.value}`, {
      method: "PATCH",
      body: { metadata: parsed || {} },
    })

    metadataOpen.value = false
    setMessage("Branch details updated.")
    await loadBranches()
  })
}

async function goToBranchArea(area: "asset" | "device_machine" | "payment" | "order") {
  const branch = selectedBranch.value
  if (!branch) return

  const tenantId = encodeURIComponent(branch.tenantId)
  const branchId = encodeURIComponent(branch.id)
  const merchantId = encodeURIComponent(branch.merchantAccountId || "")

  if (area === "asset") {
    const merchantQuery = branch.merchantAccountId ? `&merchantAccountId=${merchantId}` : ""
    await navigateTo(`/admin/assets?tenantId=${tenantId}&branchId=${branchId}${merchantQuery}`)
    return
  }

  const merchantQuery = branch.merchantAccountId ? `&merchantAccountId=${merchantId}` : ""
  await navigateTo(`/admin/ops?tenantId=${tenantId}&branchId=${branchId}${merchantQuery}`)
}

onMounted(async () => {
  selectedTenantFilter.value = readTenantId()
  selectedMerchantFilter.value = readMerchantId()

  await loadTenants()
  await loadMerchantsByTenant(selectedTenantFilter.value)

  if (selectedMerchantFilter.value && !merchants.value.some(item => item.id === selectedMerchantFilter.value)) {
    selectedMerchantFilter.value = ""
  }

  await loadBranches(true)
})

watch(
  () => [route.query.tenantId, route.query.merchantAccountId],
  async () => {
    selectedTenantFilter.value = readTenantId()
    selectedMerchantFilter.value = readMerchantId()
    await loadMerchantsByTenant(selectedTenantFilter.value)
    if (selectedMerchantFilter.value && !merchants.value.some(item => item.id === selectedMerchantFilter.value)) {
      selectedMerchantFilter.value = ""
    }
    await loadBranches(true)
  },
)

watch(
  selectedBranchId,
  async (branchId) => {
    if (!branchId) {
      branchSummary.value = null
      summaryError.value = ""
      return
    }
    await loadBranchSummary(branchId)
  },
  { immediate: true },
)
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Branch Management</h1>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        New branch page: structure aligned with merchants.
      </p>
    </div>

    <UAlert
      v-if="message"
      color="success"
      variant="soft"
      icon="i-lucide-check-circle-2"
      :title="message"
    />
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      :title="error"
    />

    <UCard
      v-if="selectedBranch"
      :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }"
    >
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ selectedBranch.name }} ({{ selectedBranch.code }})
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ tenantLabel(selectedBranch.tenantId) }} | {{ merchantLabel(selectedBranch.merchantAccountId) }}
            </p>
          </div>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="summaryLoading"
            @click="loadBranchSummary(selectedBranchId)"
          >
            Refresh
          </UButton>
        </div>
      </template>

      <UAlert
        v-if="summaryError"
        color="error"
        variant="soft"
        icon="i-lucide-alert-triangle"
        :title="summaryError"
        class="mb-3"
      />

      <div v-if="summaryLoading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading summary...
      </div>

      <div v-else-if="branchSummary" class="overflow-x-auto">
        <div class="grid min-w-[820px] grid-cols-4 gap-2">
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToBranchArea('asset')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-package" class="size-4" />
              <span>Assets</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ branchSummary.assetCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToBranchArea('device_machine')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-cpu" class="size-4" />
              <span>Devices / Machines</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ branchSummary.deviceCount }} / {{ branchSummary.machineCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToBranchArea('payment')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-wallet" class="size-4" />
              <span>Payment</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ branchSummary.paymentCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToBranchArea('order')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-shopping-cart" class="size-4" />
              <span>Order</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ branchSummary.orderCount }}</p>
          </button>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Branch List</h2>
          <div class="flex items-center gap-2">
            <select
              v-model="selectedTenantFilter"
              class="w-[280px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              @change="onTenantFilterChange"
            >
              <option value="">All tenants</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                {{ tenant.name }}
              </option>
            </select>

            <select
              v-model="selectedMerchantFilter"
              class="w-[260px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              @change="onMerchantFilterChange"
            >
              <option value="">All merchant (brand)</option>
              <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">
                {{ merchant.name }}
              </option>
            </select>

            <SearchInput
              v-model="query"
              placeholder="Search branch..."
              class="w-[280px]"
              @enter="onSearch"
            />
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
      </template>

      <div class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table class="w-full min-w-[1260px] text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr class="text-left">
              <th class="px-3 py-2">code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Merchant (Brand)</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Details</th>
              <th class="px-3 py-2">createdAt</th>
              <th class="px-3 py-2">updatedAt</th>
              <th class="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in branches"
              :key="item.id"
              class="cursor-pointer border-t border-slate-200 transition-colors duration-150 dark:border-slate-800"
              :class="selectedBranchId === item.id
                ? 'bg-blue-100/80 text-slate-900 hover:bg-blue-200/80 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-700/80'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'"
              @click="selectBranch(item)"
            >
              <td class="px-3 py-2">
                <span class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {{ item.code }}
                </span>
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <template v-if="editingNameId === item.id">
                    <UInput
                      v-model="nameEditValue"
                      placeholder="Branch name"
                      class="w-full"
                      :ui="inputUi"
                    />
                    <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="loading" @click="saveName(item)" />
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEditName" />
                  </template>
                  <template v-else>
                    <span class="truncate">{{ item.name }}</span>
                    <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click="startEditName(item)" />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                {{ merchantLabel(item.merchantAccountId) }}
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <template v-if="editingStatusId === item.id">
                    <select
                      v-model="statusEditValue"
                      class="w-[140px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                    <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="loading" @click="saveStatus(item)" />
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEditStatus" />
                  </template>
                  <template v-else>
                    <span class="text-xs font-semibold" :class="branchStatusClass(item.status)">
                      {{ item.status }}
                    </span>
                    <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click="startEditStatus(item)" />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <code v-if="item.metadata" class="text-xs text-slate-600 dark:text-slate-300">{{ formatMetadata(item.metadata) }}</code>
                  <UButton
                    v-if="item.metadata"
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-info"
                    class="font-semibold text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    @click="openMetadata(item)"
                  >
                    Details
                  </UButton>
                  <UButton
                    v-else
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-plus"
                    class="font-semibold text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    @click="openMetadata(item)"
                  >
                    Add Details
                  </UButton>
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                {{ formatDate(item.createdAt) }}
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                {{ formatDate(item.updatedAt) }}
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-1">
                  <UButton size="xs" color="neutral" variant="soft" class="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" icon="i-lucide-package" @click.stop="goToBranchArea('asset')" />
                  <UButton size="xs" color="neutral" variant="soft" class="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" icon="i-lucide-cpu" @click.stop="goToBranchArea('device_machine')" />
                </div>
              </td>
            </tr>
            <tr v-if="branches.length === 0">
              <td colspan="8" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No branches found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Showing {{ branches.length }} of {{ total }} branches
        </p>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-chevrons-left"
            :disabled="!hasPrevPage || loading"
            @click="goToPage(1)"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-chevron-left"
            :disabled="!hasPrevPage || loading"
            @click="goToPage(page - 1)"
          />
          <span class="px-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            Page {{ page }} / {{ totalPages }}
          </span>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-chevron-right"
            :disabled="!hasNextPage || loading"
            @click="goToPage(page + 1)"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-chevrons-right"
            :disabled="!hasNextPage || loading"
            @click="goToPage(totalPages)"
          />
        </div>
      </div>
    </UCard>

    <UModal v-model:open="createOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Branch</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateDialog" />
            </div>
          </template>

          <div class="space-y-3">
            <UFormField label="Tenant">
              <select
                v-model="createForm.tenantId"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                @change="onCreateTenantChange"
              >
                <option value="">Select tenant</option>
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                  {{ tenant.name }}
                </option>
              </select>
            </UFormField>

            <UFormField label="Merchant (Brand)">
              <select
                v-model="createForm.merchantAccountId"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">No merchant (brand)</option>
                <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">
                  {{ merchant.name }}
                </option>
              </select>
            </UFormField>

            <UFormField label="Code">
              <UInput
                v-model="createForm.code"
                placeholder="BR-00001"
                :ui="inputUi"
              />
            </UFormField>

            <UFormField label="Name">
              <UInput
                v-model="createForm.name"
                placeholder="Branch name"
                :ui="inputUi"
              />
            </UFormField>

            <UFormField label="Status">
              <select
                v-model="createForm.status"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" class="text-slate-700 dark:text-slate-100" @click="closeCreateDialog">
                Cancel
              </UButton>
              <UButton color="primary" class="text-white" :loading="loading" @click="createBranch">
                Create Branch
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="metadataOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ metadataTitle }}</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="metadataOpen = false" />
            </div>
          </template>

          <textarea
            v-model="metadataRaw"
            rows="14"
            class="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700 outline-none ring-primary/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500"
            placeholder="{ &quot;locationHint&quot;: &quot;2nd floor&quot;, &quot;note&quot;: &quot;optional&quot; }"
          />

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" class="text-slate-700 dark:text-slate-100" @click="metadataOpen = false">
                Cancel
              </UButton>
              <UButton color="primary" class="text-white" :loading="loading" @click="saveMetadata">
                Save Details
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
