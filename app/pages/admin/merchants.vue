<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"

definePageMeta({
  middleware: "portal-auth",
})

type MerchantStatus = "ACTIVE" | "SUSPENDED" | "DISABLED"
type MerchantEnvironment = "TEST" | "LIVE"
type Tenant = {
  id: string
  code: string
  name: string
}

type MerchantRecord = {
  id: string
  tenantId: string
  tenant?: Tenant | null
  code: string
  name: string
  status: MerchantStatus
  environment: MerchantEnvironment
  metadata?: Record<string, any> | null
  branches?: { id: string }[]
  createdAt: string
  updatedAt: string
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
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const merchants = ref<MerchantRecord[]>([])
const tenants = ref<Tenant[]>([])
const selectedMerchantId = ref("")

const summaryLoading = ref(false)
const summaryError = ref("")
const merchantSummary = ref<MerchantSummary | null>(null)

const createOpen = ref(false)
const createForm = ref({
  tenantId: "",
  name: "",
  status: "ACTIVE" as MerchantStatus,
  environment: "TEST" as MerchantEnvironment,
})


const metadataOpen = ref(false)
const metadataTitle = ref("")
const metadataMerchantId = ref("")
const metadataRaw = ref("")
const editOpen = ref(false)
const deleting = ref(false)
const deleteOpen = ref(false)
const editTargetId = ref("")
const deleteTargetId = ref("")
const editForm = ref({
  name: "",
  status: "ACTIVE" as MerchantStatus,
  environment: "TEST" as MerchantEnvironment,
})

const inputUi = {
  base: "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600",
}
const selectUi = {
  base: "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-600",
  content: "bg-white dark:bg-slate-800",
  item: "text-slate-900 dark:text-slate-100",
  value: "text-slate-900 dark:text-slate-100",
  placeholder: "text-slate-500 dark:text-slate-400",
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasPrevPage = computed(() => page.value > 1)
const hasNextPage = computed(() => page.value < totalPages.value)
const selectedMerchant = computed(() => merchants.value.find(item => item.id === selectedMerchantId.value) || null)
const tenantFilterOptions = computed(() => {
  const mapped = new Map<string, Tenant>()
  for (const tenant of tenants.value) {
    mapped.set(tenant.id, tenant)
  }
  for (const item of merchants.value) {
    if (item.tenant?.id && !mapped.has(item.tenant.id)) {
      mapped.set(item.tenant.id, {
        id: item.tenant.id,
        code: item.tenant.code,
        name: item.tenant.name,
      })
    }
  }
  return Array.from(mapped.values())
})

function readTenantId(): string {
  const raw = route.query.tenantId
  return typeof raw === "string" ? raw.trim() : ""
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

function merchantStatusClass(status: MerchantStatus) {
  if (status === "ACTIVE") return "text-emerald-600 dark:text-emerald-400"
  if (status === "SUSPENDED") return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function setMessage(text: string) {
  message.value = text
  error.value = ""
}

function setError(err: unknown) {
  message.value = ""
  error.value = err instanceof Error ? err.message : "Request failed"
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

async function loadTenants() {
  try {
    const collected: Tenant[] = []
    let nextPage = 1
    const maxPages = 20
    const pageSize = 200

    while (nextPage <= maxPages) {
      const response = await $fetch<{ items: Tenant[] }>("/api/admin/tenants", {
        query: { page: nextPage, pageSize },
      })
      const items = response.items || []
      collected.push(...items)
      if (items.length < pageSize) break
      nextPage += 1
    }

    tenants.value = collected
  } catch (err) {
    tenants.value = []
    setError(err)
  }
}

function tenantLabel(tenantId: string) {
  const tenant = tenants.value.find(item => item.id === tenantId)
    || merchants.value.find(item => item.tenantId === tenantId)?.tenant
  if (!tenant) return "-"
  return tenant.name
}

async function loadMerchants(resetPage = false) {
  await run(async () => {
    if (resetPage) page.value = 1
    const tenantId = selectedTenantFilter.value
    const response = await $fetch<PagingResponse<MerchantRecord>>("/api/admin/merchants", {
      query: {
        ...(tenantId ? { tenantId } : {}),
        ...(query.value ? { q: query.value } : {}),
        page: page.value,
        pageSize: pageSize.value,
      },
    })

    merchants.value = response.items || []
    total.value = Number(response.total || 0)
    page.value = Number(response.page || page.value)
    pageSize.value = Number(response.pageSize || pageSize.value)

    const stillExists = merchants.value.some(item => item.id === selectedMerchantId.value)
    if (!stillExists) {
      selectedMerchantId.value = merchants.value[0]?.id || ""
    }
  })
}

async function loadMerchantSummary(merchantId: string) {
  summaryLoading.value = true
  summaryError.value = ""
  try {
    merchantSummary.value = await $fetch<MerchantSummary>(`/api/admin/merchants/${merchantId}/summary`)
  } catch (err) {
    merchantSummary.value = null
    summaryError.value = err instanceof Error ? err.message : "Failed to load merchant summary"
  } finally {
    summaryLoading.value = false
  }
}

function selectMerchant(item: MerchantRecord) {
  selectedMerchantId.value = item.id
}

function refreshMerchants() {
  void loadMerchants()
  if (selectedMerchantId.value) {
    void loadMerchantSummary(selectedMerchantId.value)
  }
}

async function onSearch() {
  page.value = 1
  await loadMerchants()
}

async function onTenantFilterChange() {
  page.value = 1
  await loadMerchants()
}

async function goToPage(target: number) {
  const next = Math.min(Math.max(1, target), totalPages.value)
  if (next === page.value) return
  page.value = next
  await loadMerchants()
}

function openCreateDialog() {
  const routeTenantId = selectedTenantFilter.value || readTenantId()
  createForm.value = {
    tenantId: routeTenantId,
    name: "",
    status: "ACTIVE",
    environment: "TEST",
  }
  createOpen.value = true
}

function closeCreateDialog() {
  createOpen.value = false
}

async function createMerchant() {
  await run(async () => {
    const tenantId = (createForm.value.tenantId || "").trim()
    const name = (createForm.value.name || "").trim()
    if (!tenantId) throw new Error("Tenant is required.")
    if (!name) throw new Error("Merchant name is required.")

    await $fetch("/api/admin/merchants", {
      method: "POST",
      body: {
        tenantId,
        name,
        status: createForm.value.status,
        environment: createForm.value.environment,
      },
    })

    setMessage("Merchant created.")
    closeCreateDialog()
    await loadMerchants()
  })
}


function openMetadata(item: MerchantRecord) {
  metadataTitle.value = `${item.code} details`
  metadataMerchantId.value = item.id
  metadataRaw.value = item.metadata ? JSON.stringify(item.metadata, null, 2) : "{}"
  metadataOpen.value = true
}

async function saveMetadata() {
  await run(async () => {
    if (!metadataMerchantId.value) throw new Error("Missing merchant id.")
    let parsed: Record<string, any> | null = null
    const raw = metadataRaw.value.trim()
    if (raw) {
      parsed = JSON.parse(raw)
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Details must be a JSON object.")
      }
    }

    await $fetch(`/api/admin/merchants/${metadataMerchantId.value}`, {
      method: "PATCH",
      body: { metadata: parsed || {} },
    })

    metadataOpen.value = false
    setMessage("Merchant details updated.")
    await loadMerchants()
  })
}

function openEditDialog(item: MerchantRecord) {
  editTargetId.value = item.id
  editForm.value = {
    name: item.name,
    status: item.status,
    environment: item.environment,
  }
  editOpen.value = true
}

async function saveEditDialog() {
  await run(async () => {
    if (!editTargetId.value) throw new Error("Missing merchant id.")
    const name = editForm.value.name.trim()
    if (!name) throw new Error("Merchant name is required.")
    await $fetch(`/api/admin/merchants/${editTargetId.value}`, {
      method: "PATCH",
      body: {
        name,
        status: editForm.value.status,
        environment: editForm.value.environment,
      },
    })
    editOpen.value = false
    setMessage("Merchant updated.")
    await loadMerchants()
  })
}

function openDeleteDialog(item: MerchantRecord) {
  deleteTargetId.value = item.id
  deleteOpen.value = true
}

async function confirmDeleteMerchant() {
  if (!deleteTargetId.value) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/merchants/${deleteTargetId.value}`, { method: "DELETE" })
    deleteOpen.value = false
    deleteTargetId.value = ""
    setMessage("Merchant deleted.")
    await loadMerchants()
  } catch (err) {
    setError(err)
  } finally {
    deleting.value = false
  }
}

async function goToMerchantArea(area: "branch" | "asset" | "device" | "payment" | "biller" | "user" | "order") {
  const item = selectedMerchant.value
  if (!item) return
  const tenantId = encodeURIComponent(item.tenantId)
  const merchantId = encodeURIComponent(item.id)

  if (area === "branch") {
    await navigateTo(`/admin/branchs?tenantId=${tenantId}&merchantAccountId=${merchantId}`)
    return
  }
  if (area === "asset") {
    await navigateTo(`/admin/assets?tenantId=${tenantId}&merchantAccountId=${merchantId}`)
    return
  }
  await navigateTo(`/admin/ops?tenantId=${tenantId}&merchantAccountId=${merchantId}`)
}

onMounted(async () => {
  selectedTenantFilter.value = readTenantId()
  await loadTenants()
  await loadMerchants(true)
})

watch(
  () => route.query.tenantId,
  async () => {
    selectedTenantFilter.value = readTenantId()
    await loadMerchants(true)
  },
)

watch(
  selectedMerchantId,
  async (merchantId) => {
    if (!merchantId) {
      merchantSummary.value = null
      summaryError.value = ""
      return
    }
    await loadMerchantSummary(merchantId)
  },
  { immediate: true },
)
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Merchant Management</h1>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Merchant list only: code locked, name editable, status active/inactive.
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
      v-if="selectedMerchant"
      :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }"
    >
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ selectedMerchant.name }} ({{ selectedMerchant.code }})
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ tenantLabel(selectedMerchant.tenantId) }}
            </p>
          </div>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="summaryLoading"
            @click="loadMerchantSummary(selectedMerchantId)"
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

      <div v-else-if="merchantSummary" class="overflow-x-auto">
        <div class="grid min-w-[840px] grid-cols-7 gap-1">
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToMerchantArea('branch')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-building-2" class="size-4" />
              <span>Branch</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ merchantSummary.branchCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToMerchantArea('asset')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-package" class="size-4" />
              <span>Asset</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ merchantSummary.assetCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToMerchantArea('device')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-cpu" class="size-4" />
              <span>Device</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ merchantSummary.deviceCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToMerchantArea('order')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-shopping-cart" class="size-4" />
              <span>Orders</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ merchantSummary.orderCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToMerchantArea('payment')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-wallet" class="size-4" />
              <span>Payment</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ merchantSummary.paymentCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToMerchantArea('biller')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-receipt-text" class="size-4" />
              <span>Biller</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ merchantSummary.billerCount }}</p>
          </button>

          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToMerchantArea('user')">
            <p class="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-users" class="size-4" />
              <span>User</span>
            </p>
            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ merchantSummary.userCount }}</p>
          </button>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Merchant List</h2>
          <div class="flex items-center gap-2">
            <select
              v-model="selectedTenantFilter"
              class="w-[320px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              @change="onTenantFilterChange"
            >
              <option value="">All tenants</option>
              <option v-for="tenant in tenantFilterOptions" :key="tenant.id" :value="tenant.id">
                {{ tenant.name }}
              </option>
            </select>
            <SearchInput
              v-model="query"
              placeholder="Search merchant..."
              class="w-[320px]"
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
        <table class="w-full min-w-[1200px] text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr class="text-left">
              <th class="px-3 py-2">code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Environment</th>
              <th class="px-3 py-2">Details</th>
              <th class="px-3 py-2">createdAt</th>
              <th class="px-3 py-2">updatedAt</th>
              <th class="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in merchants"
              :key="item.id"
              class="cursor-pointer border-t border-slate-200 transition-colors duration-150 dark:border-slate-800"
              :class="selectedMerchantId === item.id
                ? 'bg-blue-100/80 text-slate-900 hover:bg-blue-200/80 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-700/80'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'"
              @click="selectMerchant(item)"
            >
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <span class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {{ item.code }}
                  </span>
                  <CopyIconButton :value="item.code" aria-label="Copy merchant code" />
                </div>
              </td>
              <td class="px-3 py-2">
                <span class="truncate">{{ item.name }}</span>
              </td>
              <td class="px-3 py-2">
                <span class="text-xs font-semibold" :class="merchantStatusClass(item.status)">
                  {{ item.status }}
                </span>
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                {{ item.environment }}
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
                <DateTimeTwoLine :value="item.createdAt" />
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                <DateTimeTwoLine :value="item.updatedAt" />
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-1">
                  <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click.stop="openEditDialog(item)" />
                  <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click.stop="openDeleteDialog(item)" />
                </div>
              </td>
            </tr>
            <tr v-if="merchants.length === 0">
              <td colspan="8" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No merchants found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Showing {{ merchants.length }} of {{ total }} merchants
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

    <UModal v-model:open="editOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Edit Merchant</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="editOpen = false" />
            </div>
          </template>
          <div class="space-y-3">
            <UFormField label="Merchant Name">
              <UInput v-model="editForm.name" :ui="inputUi" />
            </UFormField>
            <div class="grid gap-3 md:grid-cols-2">
              <UFormField label="Status">
                <USelect
                  v-model="editForm.status"
                  :ui="selectUi"
                  :options="[
                    { label: 'ACTIVE', value: 'ACTIVE' },
                    { label: 'SUSPENDED', value: 'SUSPENDED' },
                    { label: 'DISABLED', value: 'DISABLED' },
                  ]"
                />
              </UFormField>
              <UFormField label="Environment">
                <USelect
                  v-model="editForm.environment"
                  :ui="selectUi"
                  :options="[
                    { label: 'TEST', value: 'TEST' },
                    { label: 'LIVE', value: 'LIVE' },
                  ]"
                />
              </UFormField>
            </div>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="editOpen = false">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="loading" @click="saveEditDialog">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Delete Merchant</h3>
          </template>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Confirm delete merchant? If already linked data exists, system will block delete.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="deleteOpen = false">Cancel</UButton>
              <UButton color="error" :loading="deleting" @click="confirmDeleteMerchant">Delete</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="createOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Merchant</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateDialog" />
            </div>
          </template>

          <div class="space-y-3">
            <UFormField label="Tenant">
              <select
                v-model="createForm.tenantId"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select tenant</option>
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                  {{ tenant.name }}
                </option>
              </select>
            </UFormField>

            <UFormField label="Name">
              <UInput
                v-model="createForm.name"
                placeholder="Merchant name"
                :ui="inputUi"
              />
            </UFormField>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <UFormField label="Environment">
                <select
                  v-model="createForm.environment"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="TEST">TEST</option>
                  <option value="LIVE">LIVE</option>
                </select>
              </UFormField>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" class="text-slate-700 dark:text-slate-100" @click="closeCreateDialog">
                Cancel
              </UButton>
              <UButton color="primary" class="text-white" :loading="loading" @click="createMerchant">
                Create Merchant
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
            placeholder="{ &quot;contactName&quot;: &quot;Merchant Owner&quot;, &quot;note&quot;: &quot;optional&quot; }"
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
