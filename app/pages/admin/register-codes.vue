<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import type { LocationQueryValue } from "vue-router"

definePageMeta({
  middleware: "platform-admin-auth",
})

type Tenant = { id: string; name: string; code: string }
type Merchant = { id: string; name: string; code: string }
type Branch = { id: string; name: string; code: string }
type RegistrationCodeItem = {
  id: string
  code: string
  status: string
  note?: string | null
  expiresAt?: string | null
  createdAt: string
  tenant?: { id: string; name: string; code: string } | null
  merchantAccount?: { id: string; name: string; code: string } | null
  branch?: { id: string; name: string; code: string } | null
}
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }

const error = ref("")
const message = ref("")
const toast = useToast()
const issueOpen = ref(false)
const issueLoading = ref(false)
const issuedCode = ref("")
const issuedCodesLoading = ref(false)
const cleaningExpired = ref(false)
const cleanupConfirmOpen = ref(false)
const deleteConfirmOpen = ref(false)
const deletingSingle = ref(false)
const pendingDeleteItem = ref<RegistrationCodeItem | null>(null)
const issuedCodes = ref<RegistrationCodeItem[]>([])
const issueCount = ref(1)
const issueExpireDays = ref<"3" | "5" | "7">("7")
const issueExpireTime = ref("00:00")
const issueNote = ref("")
const filters = ref({
  tenantId: "",
  merchantAccountId: "",
  branchId: "",
})

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])
const route = useRoute()

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
const recentColumns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "tenant", header: "Tenant" },
  { accessorKey: "merchant", header: "Merchant" },
  { accessorKey: "branch", header: "Branch" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "note", header: "Note" },
  { accessorKey: "expiresAt", header: "Expired At" },
  { accessorKey: "createdAt", header: "Created" },
  { accessorKey: "actions", header: "Actions" },
]

function setError(err: unknown) {
  const fetchErr = err as { data?: { statusMessage?: string }; message?: string } | undefined
  const statusMessage = fetchErr?.data?.statusMessage
  error.value = statusMessage || (err instanceof Error ? err.message : "Request failed")
  message.value = ""
  toast.add({
    title: "Request failed",
    description: error.value,
    color: "error"
  })
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>("/api/admin/tenants", {
    query: { page: 1, pageSize: 200 },
  })
  tenants.value = response.items || []
}

async function loadMerchants() {
  if (!filters.value.tenantId) {
    merchants.value = []
    return
  }
  const response = await $fetch<PagingResponse<Merchant>>("/api/admin/merchants", {
    query: { tenantId: filters.value.tenantId, page: 1, pageSize: 200 },
  })
  merchants.value = response.items || []
}

async function loadBranches() {
  if (!filters.value.tenantId) {
    branches.value = []
    return
  }
  const response = await $fetch<PagingResponse<Branch>>("/api/admin/branches", {
    query: {
      tenantId: filters.value.tenantId,
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      page: 1,
      pageSize: 200,
    },
  })
  branches.value = response.items || []
}

function openIssueDialog() {
  if (!filters.value.tenantId) {
    error.value = "Please select tenant before issuing registration code."
    return
  }
  issuedCode.value = ""
  issueOpen.value = true
  void loadIssuedCodes()
}

function closeIssueDialog() {
  issueOpen.value = false
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
    if (filters.value.merchantAccountId) query.merchantAccountId = filters.value.merchantAccountId
    if (filters.value.branchId) query.branchId = filters.value.branchId
    const response = await $fetch<{ items: RegistrationCodeItem[] }>("/api/admin/device-registration-codes", { query })
    issuedCodes.value = response.items || []
  } catch {
    issuedCodes.value = []
  } finally {
    issuedCodesLoading.value = false
  }
}

function isRegistrationExpired(item: RegistrationCodeItem) {
  if (item.status === "EXPIRED") return true
  if (!item.expiresAt) return false
  return new Date(item.expiresAt).getTime() < Date.now()
}

function canDeleteRegistrationCode(item: RegistrationCodeItem) {
  return item.status === "READY" || isRegistrationExpired(item)
}

async function issueRegistrationCode() {
  if (!filters.value.tenantId) {
    error.value = "Tenant is required."
    return
  }

  issueLoading.value = true
  error.value = ""
  try {
    const endpoint = "/api/admin/device-registration-codes/batch"
    const body: Record<string, unknown> = { tenantId: filters.value.tenantId }
    const note = issueNote.value.trim()
    if (note) body.note = note
    body.count = Math.min(50, Math.max(1, Number(issueCount.value || 1)))
    body.expiresAt = new Date(Date.now() + Number(issueExpireDays.value) * 24 * 60 * 60 * 1000).toISOString()
    body.merchantAccountId = filters.value.merchantAccountId || null
    body.branchId = filters.value.branchId || null

    const response = await $fetch<{ plainCodes: string[] }>(endpoint, {
      method: "POST",
      body
    })

    issuedCode.value = response.plainCodes?.[0] || ""
    await loadIssuedCodes()
    issueOpen.value = false
  } catch (err) {
    setError(err)
  } finally {
    issueLoading.value = false
  }
}

async function deleteRegistrationCode(item: RegistrationCodeItem) {
  pendingDeleteItem.value = item
  deleteConfirmOpen.value = true
}

async function confirmDeleteRegistrationCode() {
  if (!pendingDeleteItem.value) return
  deletingSingle.value = true
  try {
    await $fetch(`/api/admin/device-registration-codes/${pendingDeleteItem.value.id}`, {
      method: "delete",
      body: { confirmText: "DELETE" }
    } as any)
    toast.add({
      title: "Delete registration code",
      description: "Registration code deleted.",
      color: "success"
    })
    await loadIssuedCodes()
  } catch (err) {
    setError(err)
  } finally {
    deletingSingle.value = false
    deleteConfirmOpen.value = false
    pendingDeleteItem.value = null
  }
}

async function cleanupExpiredCodes() {
  if (!filters.value.tenantId) {
    error.value = "Please select tenant first."
    return
  }
  cleaningExpired.value = true
  error.value = ""
  message.value = ""
  try {
    const checked = await $fetch<{ ok: boolean; updated: number }>("/api/admin/device-registration-codes/check-expired", {
      method: "POST",
      body: {
        tenantId: filters.value.tenantId,
        merchantAccountId: filters.value.merchantAccountId || null,
        branchId: filters.value.branchId || null,
      },
    })
    const deleted = await $fetch<{ ok: boolean; deleted: number }>("/api/admin/device-registration-codes/delete-expired", {
      method: "POST",
      body: {
        confirmText: "DELETE",
        tenantId: filters.value.tenantId,
        merchantAccountId: filters.value.merchantAccountId || null,
        branchId: filters.value.branchId || null,
      },
    } as any)
    message.value = deleted.deleted > 0
      ? `Cleanup complete. Updated ${checked.updated} and deleted ${deleted.deleted} expired code(s).`
      : (checked.updated > 0
        ? `Updated ${checked.updated} code(s) to EXPIRED, but no records remained for deletion.`
        : "No expired codes found in current scope.")
    toast.add({
      title: "Cleanup Expired",
      description: message.value,
      color: "success"
    })
    await loadIssuedCodes()
  } catch (err) {
    setError(err)
  } finally {
    cleaningExpired.value = false
  }
}

function openCleanupConfirm() {
  if (!filters.value.tenantId) {
    error.value = "Please select tenant first."
    return
  }
  cleanupConfirmOpen.value = true
}

function queryValue(input: LocationQueryValue | LocationQueryValue[] | undefined) {
  if (Array.isArray(input)) return input[0] || ""
  return input || ""
}


watch(
  () => filters.value.tenantId,
  async () => {
    filters.value.merchantAccountId = ""
    filters.value.branchId = ""
    await Promise.all([loadMerchants(), loadBranches()])
    void loadIssuedCodes()
  },
)

watch(
  () => filters.value.merchantAccountId,
  async () => {
    filters.value.branchId = ""
    await loadBranches()
    void loadIssuedCodes()
  },
)

watch(
  () => filters.value.branchId,
  () => {
    void loadIssuedCodes()
  },
)

onMounted(async () => {
  try {
    await loadTenants()
  } catch {
    tenants.value = []
  }
  const tenantId = queryValue(route.query.tenantId)
  const merchantAccountId = queryValue(route.query.merchantAccountId || route.query.merchantId)
  const branchId = queryValue(route.query.branchId)
  const expireDays = queryValue(route.query.expireDays)
  const count = queryValue(route.query.count)
  const expireTime = queryValue(route.query.expireTime)
  const note = queryValue(route.query.note)

  if (expireDays === "3" || expireDays === "5" || expireDays === "7") issueExpireDays.value = expireDays
  if (/^\d+$/.test(count)) issueCount.value = Math.min(50, Math.max(1, Number(count)))
  if (/^\d{2}:00$/.test(expireTime)) issueExpireTime.value = expireTime
  if (note) issueNote.value = note

  if (tenantId) {
    filters.value.tenantId = tenantId
    await loadMerchants()
    await loadBranches()
    if (merchantAccountId && merchants.value.some(item => item.id === merchantAccountId)) {
      filters.value.merchantAccountId = merchantAccountId
      await loadBranches()
    }
    if (branchId && branches.value.some(item => item.id === branchId)) {
      filters.value.branchId = branchId
    }
  }
  await loadIssuedCodes()
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Register Code</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Issue registration codes for asset, IoT device, and machine onboarding</p>
    </div>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-5 md:items-end">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Tenant <span class="text-rose-500">*</span></label>
              <select v-model="filters.tenantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="">All tenants</option>
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Merchant (Brand)</label>
              <select v-model="filters.merchantAccountId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="">All merchant (brand)</option>
                <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">{{ merchant.name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Branch</label>
              <select v-model="filters.branchId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="">All branches</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
              </select>
            </div>
            <div class="flex items-end justify-end md:col-span-2">
              <UButton icon="i-lucide-key-round" color="primary" class="text-white" @click="openIssueDialog">Review &amp; Issue</UButton>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Expire In <span class="text-rose-500">*</span></label>
              <select v-model="issueExpireDays" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="3">3 days</option>
                <option value="5">5 days</option>
                <option value="7">7 days</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Expire Time <span class="text-rose-500">*</span></label>
              <select v-model="issueExpireTime" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option v-for="h in 24" :key="h - 1" :value="`${String(h - 1).padStart(2, '0')}:00`">
                  {{ String(h - 1).padStart(2, '0') }}:00
                </option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Count <span class="text-rose-500">*</span></label>
              <UInput
                v-model.number="issueCount"
                type="number"
                min="1"
                max="50"
                step="1"
                class="h-10 w-full"
                :ui="{ base: 'h-10 bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-500 dark:text-slate-300">Note (Optional)</label>
              <UInput
                v-model="issueNote"
                class="h-10 w-full"
                :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400' }"
                placeholder="Add note"
              />
            </div>
          </div>
          <p class="text-sm font-semibold text-red-600 dark:text-red-400">
            Expired At: {{ issueExpiresAtPreview ? new Date(issueExpiresAtPreview).toLocaleString() : '-' }}
          </p>
        </div>
      </template>

      <p class="text-sm text-slate-500 dark:text-slate-400">
        Use filters to set scope before issuing. For ASSET code, merchant/branch scope is required.
      </p>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">Recently Issued Codes</h3>
          <div class="flex items-center gap-2">
            <UButton color="error" variant="soft" icon="i-lucide-trash-2" :loading="cleaningExpired" @click="openCleanupConfirm">Cleanup Expired</UButton>
            <UButton color="neutral" variant="soft" icon="i-lucide-refresh-cw" @click="loadIssuedCodes">Refresh</UButton>
          </div>
        </div>
      </template>
      <div class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <UTable :data="issuedCodes" :columns="recentColumns" class="text-sm">
          <template #code-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-mono">{{ row.original.code }}</span>
              <CopyIconButton :value="row.original.code" aria-label="Copy registration code item" />
            </div>
          </template>
          <template #status-cell="{ row }">
            <span class="font-semibold" :class="row.original.status === 'READY' ? 'text-emerald-600 dark:text-emerald-400' : row.original.status === 'USED' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'">
              {{ row.original.status }}
            </span>
          </template>
          <template #tenant-cell="{ row }">
            <span>{{ row.original.tenant?.name || '-' }}</span>
          </template>
          <template #merchant-cell="{ row }">
            <span>{{ row.original.merchantAccount?.name || '-' }}</span>
          </template>
          <template #branch-cell="{ row }">
            <span>{{ row.original.branch?.name || '-' }}</span>
          </template>
          <template #note-cell="{ row }">
            <span>{{ row.original.note || '-' }}</span>
          </template>
          <template #expiresAt-cell="{ row }">
            <DateTimeTwoLine :value="row.original.expiresAt || null" />
          </template>
          <template #createdAt-cell="{ row }">
            <DateTimeTwoLine :value="row.original.createdAt" />
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-center">
              <UButton
                v-if="canDeleteRegistrationCode(row.original)"
                color="error"
                variant="soft"
                icon="i-lucide-trash-2"
                size="xs"
                @click="deleteRegistrationCode(row.original)"
              />
              <span v-else class="text-slate-400">-</span>
            </div>
          </template>
        </UTable>
      </div>
      <p v-if="issuedCodesLoading" class="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      <p v-else-if="!issuedCodes.length" class="mt-2 text-sm text-slate-500 dark:text-slate-400">No issued code found</p>
    </UCard>

    <AssetIssueRegisterCodeModal
      v-model:open="issueOpen"
      :issue-loading="issueLoading"
      :issued-code="issuedCode"
      :issue-expires-at-preview="issueExpiresAtPreview"
      :issue-expire-days="issueExpireDays"
      :issue-expire-time="issueExpireTime"
      :issue-note="issueNote"
      :tenant-name="tenants.find(t => t.id === filters.tenantId)?.name || '-'"
      :merchant-name="merchants.find(m => m.id === filters.merchantAccountId)?.name || '-'"
      :branch-name="branches.find(b => b.id === filters.branchId)?.name || '-'"
      @close="closeIssueDialog"
      @issue="issueRegistrationCode"
    />

    <UModal
      v-model:open="cleanupConfirmOpen"
      :ui="{ content: 'sm:max-w-md bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }"
    >
      <template #content>
        <div class="space-y-4 p-4">
          <div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Cleanup Expired Codes</h3>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              This will mark expired READY codes as EXPIRED and then delete EXPIRED codes in current filter scope.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2">
            <UButton color="neutral" variant="soft" :disabled="cleaningExpired" @click="cleanupConfirmOpen = false">Cancel</UButton>
            <UButton color="error" class="text-white" :loading="cleaningExpired" @click="cleanupConfirmOpen = false; cleanupExpiredCodes()">Confirm Cleanup</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteConfirmOpen"
      :ui="{ content: 'sm:max-w-md bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }"
    >
      <template #content>
        <div class="space-y-4 p-4">
          <div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Delete Registration Code</h3>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              This action will permanently delete the selected registration code.
            </p>
            <p class="mt-2 font-mono text-sm text-slate-900 dark:text-slate-100">
              {{ pendingDeleteItem?.code || '-' }}
            </p>
          </div>
          <div class="flex items-center justify-end gap-2">
            <UButton color="neutral" variant="soft" :disabled="deletingSingle" @click="deleteConfirmOpen = false; pendingDeleteItem = null">Cancel</UButton>
            <UButton color="error" class="text-white" :loading="deletingSingle" @click="confirmDeleteRegistrationCode">Confirm Delete</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
