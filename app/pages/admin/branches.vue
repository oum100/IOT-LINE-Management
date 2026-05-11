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

type Merchant = {
  id: string
  code: string
  name: string
}

type Branch = {
  id: string
  code: string
  name: string
  status: "ACTIVE" | "SUSPENDED" | "DISABLED"
  createdAt: string
  updatedAt: string
  merchantAccount?: {
    id: string
    code: string
    name: string
  } | null
}

type PagingResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

type ListFilters = {
  tenantId: string
  merchantAccountId: string
  q: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref("")
const message = ref("")
const saving = ref(false)
const deleting = ref(false)
const editOpen = ref(false)
const deleteOpen = ref(false)
const editTargetId = ref("")
const deleteTargetId = ref("")
const editForm = ref({
  name: "",
  status: "ACTIVE" as Branch["status"],
})
const filters = ref<ListFilters>({
  tenantId: "",
  merchantAccountId: "",
  q: "",
})
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const branches = ref<Branch[]>([])

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const inputUi = {
  base: "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600",
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

function setError(err: unknown) {
  error.value = err instanceof Error ? err.message : "Request failed"
}

function setMessage(text: string) {
  message.value = text
  error.value = ""
}

function resetPage() {
  page.value = 1
}

function branchStatusClass(status: Branch["status"]) {
  if (status === "ACTIVE") return "text-emerald-600 dark:text-emerald-400"
  if (status === "SUSPENDED") return "text-amber-600 dark:text-amber-400"
  return "text-slate-500 dark:text-slate-400"
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function toMerchantLabel(item?: Branch["merchantAccount"] | null) {
  if (!item) return "-"
  return `${item.code} ${item.name}`
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
  const q = typeof route.query.q === "string" ? route.query.q : ""
  const pageQuery = Number(route.query.page)
  const pageSizeQuery = Number(route.query.pageSize)

  filters.value.tenantId = tenantId
  filters.value.merchantAccountId = merchantAccountId
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

async function loadBranches() {
  if (!filters.value.tenantId) {
    branches.value = []
    total.value = 0
    return
  }

  loading.value = true
  error.value = ""
  try {
    const response = await $fetch<PagingResponse<Branch>>("/api/admin/branches", {
      query: {
        tenantId: filters.value.tenantId,
        ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
        ...(filters.value.q ? { q: filters.value.q } : {}),
        page: page.value,
        pageSize: pageSize.value,
      },
    })

    branches.value = response.items || []
    total.value = Number(response.total || 0)
    page.value = Number(response.page || page.value)
    pageSize.value = Number(response.pageSize || pageSize.value)
  } catch (err) {
    branches.value = []
    total.value = 0
    setError(err)
  } finally {
    loading.value = false
  }
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
    await loadBranches()
  } catch (err) {
    setError(err)
  }
}

function syncRoute() {
  const query: Record<string, string | number> = {
    tenantId: filters.value.tenantId,
    page: page.value,
    pageSize: pageSize.value,
  }
  if (filters.value.merchantAccountId) {
    query.merchantAccountId = filters.value.merchantAccountId
  }
  if (filters.value.q) {
    query.q = filters.value.q
  }
  void router.replace({ query })
}

async function onSearch() {
  resetPage()
  await loadBranches()
  syncRoute()
}

function onPageChange(target: number) {
  const next = Math.min(Math.max(1, target), totalPages.value)
  if (next === page.value) return
  page.value = next
  void loadBranches()
  syncRoute()
}

function onTenantChange() {
  resetPage()
  void (async () => {
    await loadMerchants(filters.value.tenantId)
    if (!filters.value.merchantAccountId || !merchants.value.some((m) => m.id === filters.value.merchantAccountId)) {
      filters.value.merchantAccountId = ""
    }
    await loadBranches()
    syncRoute()
  })()
}

function onMerchantChange() {
  resetPage()
  void (async () => {
    await loadBranches()
    syncRoute()
  })()
}

function openEditDialog(branch: Branch) {
  editTargetId.value = branch.id
  editForm.value = {
    name: branch.name,
    status: branch.status,
  }
  editOpen.value = true
}

async function saveEditBranch() {
  if (!editTargetId.value) return
  saving.value = true
  error.value = ""
  try {
    const name = editForm.value.name.trim()
    if (!name) throw new Error("Branch name is required.")
    await $fetch(`/api/admin/branches/${editTargetId.value}`, {
      method: "PATCH",
      body: {
        name,
        status: editForm.value.status,
      },
    })
    editOpen.value = false
    setMessage("Branch updated.")
    await loadBranches()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

function openDeleteDialog(branch: Branch) {
  deleteTargetId.value = branch.id
  deleteOpen.value = true
}

async function confirmDeleteBranch() {
  if (!deleteTargetId.value) return
  deleting.value = true
  error.value = ""
  try {
    await $fetch(`/api/admin/branches/${deleteTargetId.value}`, {
      method: "DELETE",
    })
    deleteOpen.value = false
    deleteTargetId.value = ""
    setMessage("Branch deleted.")
    await loadBranches()
  } catch (err) {
    setError(err)
  } finally {
    deleting.value = false
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
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Branch Management</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        View and search branches by tenant/merchant
      </p>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
    <UAlert v-if="message" color="success" variant="soft" icon="i-lucide-check-circle-2" :title="message" />

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
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Merchant (Brand)</label>
            <USelect
              v-model="filters.merchantAccountId"
              class="w-full"
              placeholder="All merchant (brand)"
              :options="[{ label: 'All merchant (brand)', value: '' }, ...merchants.map((merchant) => ({ label: `${merchant.code} ${merchant.name}`, value: merchant.id }))]"
              @update:modelValue="onMerchantChange"
            />
          </div>
          <div class="col-span-2 flex items-end gap-2">
            <SearchInput
              v-model="filters.q"
              placeholder="Search code/name..."
              class="w-full bg-white dark:bg-slate-950"
              @enter="onSearch"
            />
          </div>
          <div class="flex justify-end">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-refresh-cw"
              class="text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60"
              :loading="loading"
              @click="loadBranches"
            >
              Refresh
            </UButton>
          </div>
        </div>
      </template>

      <div v-if="loading && !branches.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading branches...
      </div>

      <div v-else class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table class="w-full min-w-[1000px] text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr class="text-left">
              <th class="px-3 py-2">Code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Merchant (Brand)</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Updated</th>
              <th class="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="branch in branches"
              :key="branch.id"
              class="border-t border-slate-200 transition-colors duration-150 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
            >
              <td class="px-3 py-2">
                <span class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {{ branch.code }}
                </span>
              </td>
              <td class="px-3 py-2">{{ branch.name }}</td>
              <td class="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                {{ toMerchantLabel(branch.merchantAccount) }}
              </td>
              <td class="px-3 py-2">
                <span class="text-xs font-semibold" :class="branchStatusClass(branch.status)">
                  {{ branch.status }}
                </span>
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300"><DateTimeTwoLine :value="branch.updatedAt" /></td>
              <td class="px-3 py-2">
                <div class="flex items-center justify-center gap-1">
                  <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click.stop="openEditDialog(branch)" />
                  <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click.stop="openDeleteDialog(branch)" />
                </div>
              </td>
            </tr>
            <tr v-if="!branches.length">
              <td colspan="6" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No branches found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Showing {{ branches.length }} of {{ total }} branches
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

    <UModal v-model:open="editOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Edit Branch</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="editOpen = false" />
            </div>
          </template>
          <div class="space-y-3">
            <UFormField label="Branch Name">
              <UInput v-model="editForm.name" :ui="inputUi" />
            </UFormField>
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
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="editOpen = false">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="saving" @click="saveEditBranch">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Delete Branch</h3>
          </template>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Confirm delete branch? If linked data exists, system will block delete.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="deleteOpen = false">Cancel</UButton>
              <UButton color="error" :loading="deleting" @click="confirmDeleteBranch">Delete</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
