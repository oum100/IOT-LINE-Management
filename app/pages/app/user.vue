<script setup lang="ts">
definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})

type GovernanceResponse = {
  users: Array<{
    id: string
    email: string
    name: string | null
    role: 'OWNER' | 'MANAGER' | 'STAFF'
    isActive: boolean
    merchantAccountId: string | null
    emailVerified: string | null
    image: string | null
    createdAt: string
    updatedAt: string
    merchantAccount: {
      id: string
      name: string
      code: string
    } | null
    scopeAssignments: Array<{
      scopeType: 'MERCHANT' | 'BRANCH'
      merchantAccountId: string | null
      branchId: string | null
    }>
  }>
}

type TenantDetailResponse = {
  tenant?: { id: string; code: string; name: string } | null
  merchants: Array<{ id: string; code: string; name: string }>
  branches: Array<{ id: string; code: string; name: string; merchantAccountId: string | null }>
}

const governanceUserSavingId = ref('')
const governanceUserError = ref('')
const createUserOpen = ref(false)
const createUserSaving = ref(false)
const createUserError = ref('')
const createUserEmail = ref('')
const createUserName = ref('')
const createUserRole = ref<'OWNER' | 'MANAGER' | 'STAFF'>('STAFF')
const createUserMerchantAccountId = ref('')
const createScopeMerchantIds = ref<string[]>([])
const createScopeBranchIds = ref<string[]>([])
const createUserIsActive = ref(true)
const editUserOpen = ref(false)
const editUserSaving = ref(false)
const editUserError = ref('')
const editUserId = ref('')
const editUserName = ref('')
const editUserRole = ref<'OWNER' | 'MANAGER' | 'STAFF'>('STAFF')
const editUserMerchantAccountId = ref('')
const editScopeMerchantIds = ref<string[]>([])
const editScopeBranchIds = ref<string[]>([])
const editUserIsActive = ref(true)
const deleteUserSavingId = ref('')
const imagePreviewOpen = ref(false)
const imagePreviewUrl = ref('')

const { data: governanceData, pending: governancePending, refresh: refreshGovernance } = await useFetch<GovernanceResponse>('/api/app/governance')
const { data: tenantData } = await useFetch<TenantDetailResponse>('/api/app/tenant')

const tenantName = computed(() => tenantData.value?.tenant?.name || '-')
const tenantCode = computed(() => tenantData.value?.tenant?.code || '-')
const merchants = computed(() => tenantData.value?.merchants || [])
const branches = computed(() => tenantData.value?.branches || [])
const governanceUsers = computed(() => governanceData.value?.users || [])

const governanceUserRows = computed(() => governanceUsers.value.map((item) => ({
  ...item,
  merchantAccountLabel: item.merchantAccount?.name || '-',
  emailVerifiedLabel: item.emailVerified ? 'YES' : 'NO',
  imageLabel: item.image ? 'YES' : 'NO',
  createdAtLabel: formatDateTime(item.createdAt),
  updatedAtLabel: formatDateTime(item.updatedAt),
  isActiveLabel: item.isActive ? 'ACTIVE' : 'INACTIVE',
  scopeLabel: `${item.scopeAssignments.filter(s => s.scopeType === 'MERCHANT').length}M / ${item.scopeAssignments.filter(s => s.scopeType === 'BRANCH').length}B`
})))

const governanceUserColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'imageLabel', header: 'Image' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'merchantAccountLabel', header: 'Merchant Name' },
  { accessorKey: 'emailVerifiedLabel', header: 'EmailVerify' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'scopeLabel', header: 'Scope' },
  { accessorKey: 'isActiveLabel', header: 'IsActive' },
  { accessorKey: 'createdAtLabel', header: 'CreatedAt' },
  { accessorKey: 'updatedAtLabel', header: 'UpdatedAt' },
  { accessorKey: 'actions', header: 'Action' }
]

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-GB')
}

async function updateGovernanceUser(
  item: { id: string; role: 'OWNER' | 'MANAGER' | 'STAFF'; isActive: boolean; merchantAccountId: string | null },
  patch: { role?: 'OWNER' | 'MANAGER' | 'STAFF'; isActive?: boolean; merchantAccountId?: string | null }
) {
  governanceUserSavingId.value = item.id
  governanceUserError.value = ''
  try {
    await $fetch(`/api/app/users/${item.id}`, {
      method: 'PATCH',
      body: {
        role: patch.role ?? item.role,
        isActive: patch.isActive ?? item.isActive,
        merchantAccountId: patch.merchantAccountId !== undefined ? patch.merchantAccountId : item.merchantAccountId
      }
    })
    await refreshGovernance()
  } catch (err) {
    governanceUserError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to update user'
  } finally {
    governanceUserSavingId.value = ''
  }
}

function onGovernanceRoleChange(item: { id: string; role: 'OWNER' | 'MANAGER' | 'STAFF'; isActive: boolean; merchantAccountId: string | null }, event: Event) {
  const value = String((event.target as HTMLSelectElement | null)?.value || item.role)
  if (value === 'OWNER' || value === 'MANAGER' || value === 'STAFF') updateGovernanceUser(item, { role: value })
}

function onGovernanceMerchantChange(item: { id: string; role: 'OWNER' | 'MANAGER' | 'STAFF'; isActive: boolean; merchantAccountId: string | null }, event: Event) {
  const value = String((event.target as HTMLSelectElement | null)?.value || '')
  updateGovernanceUser(item, { merchantAccountId: value || null })
}

function openCreateUser() {
  createUserError.value = ''
  createUserEmail.value = ''
  createUserName.value = ''
  createUserRole.value = 'STAFF'
  createUserMerchantAccountId.value = ''
  createScopeMerchantIds.value = []
  createScopeBranchIds.value = []
  createUserIsActive.value = true
  createUserOpen.value = true
}

function closeCreateUser() {
  createUserOpen.value = false
  createUserSaving.value = false
  createUserError.value = ''
}

async function submitCreateUser() {
  createUserSaving.value = true
  createUserError.value = ''
  try {
    await $fetch('/api/app/users', {
      method: 'POST',
      body: {
        email: createUserEmail.value.trim(),
        name: createUserName.value.trim() || null,
        role: createUserRole.value,
        merchantAccountId: createUserMerchantAccountId.value || null,
        scopeAssignments: {
          merchantIds: createScopeMerchantIds.value,
          branchIds: createScopeBranchIds.value
        },
        isActive: createUserIsActive.value
      }
    })
    await refreshGovernance()
    closeCreateUser()
  } catch (err) {
    createUserError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to create user'
  } finally {
    createUserSaving.value = false
  }
}

function openEditUser(item: { id: string; name: string | null; role: 'OWNER' | 'MANAGER' | 'STAFF'; merchantAccountId: string | null; isActive: boolean }) {
  editUserError.value = ''
  editUserId.value = item.id
  editUserName.value = item.name || ''
  editUserRole.value = item.role
  editUserMerchantAccountId.value = item.merchantAccountId || ''
  const raw = governanceUsers.value.find(u => u.id === item.id)
  editScopeMerchantIds.value = raw?.scopeAssignments.filter(s => s.scopeType === 'MERCHANT').map(s => s.merchantAccountId || '').filter(Boolean) || []
  editScopeBranchIds.value = raw?.scopeAssignments.filter(s => s.scopeType === 'BRANCH').map(s => s.branchId || '').filter(Boolean) || []
  editUserIsActive.value = item.isActive
  editUserOpen.value = true
}

function closeEditUser() {
  editUserOpen.value = false
  editUserSaving.value = false
  editUserError.value = ''
}

async function submitEditUser() {
  if (!editUserId.value) return
  editUserSaving.value = true
  editUserError.value = ''
  try {
    await $fetch(`/api/app/users/${editUserId.value}`, {
      method: 'PATCH',
      body: {
        name: editUserName.value.trim() || null,
        role: editUserRole.value,
        merchantAccountId: editUserMerchantAccountId.value || null,
        scopeAssignments: {
          merchantIds: editScopeMerchantIds.value,
          branchIds: editScopeBranchIds.value
        },
        isActive: editUserIsActive.value
      }
    })
    await refreshGovernance()
    closeEditUser()
  } catch (err) {
    editUserError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to update user'
  } finally {
    editUserSaving.value = false
  }
}

async function deleteUser(item: { id: string }) {
  const ok = globalThis.confirm?.('Delete this user?') ?? false
  if (!ok) return
  deleteUserSavingId.value = item.id
  governanceUserError.value = ''
  try {
    await $fetch(`/api/app/users/${item.id}`, { method: 'DELETE' })
    await refreshGovernance()
  } catch (err) {
    governanceUserError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to delete user'
  } finally {
    deleteUserSavingId.value = ''
  }
}

function openImagePreview(url?: string | null) {
  if (!url) return
  imagePreviewUrl.value = url
  imagePreviewOpen.value = true
}

function closeImagePreview() {
  imagePreviewOpen.value = false
  imagePreviewUrl.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">User Workspace</h3>
        <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ tenantName }}</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Tenant: {{ tenantCode }} ({{ tenantName }})</p>
      </div>
    </div>

    <UCard :ui="{ root: 'h-[620px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">User Access</p>
        <div class="flex items-center gap-2">
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ governanceUsers.length }} users</p>
          <UButton icon="i-lucide-plus" color="primary" variant="soft" size="xs" @click="openCreateUser">Create</UButton>
        </div>
      </div>
      <div v-if="governanceUserError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{{ governanceUserError }}</div>
      <div v-if="governancePending" class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
      <div v-else class="flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <UTable :data="governanceUserRows" :columns="governanceUserColumns" sticky="header" class="user-utable h-full overflow-auto min-w-full text-sm">
          <template #name-cell="{ row }">
            <span>{{ row.original.name || '-' }}</span>
          </template>
          <template #imageLabel-cell="{ row }">
            <div class="flex justify-center">
              <button
                type="button"
                class="inline-flex rounded-full ring-1 ring-slate-300 transition hover:ring-blue-500 dark:ring-slate-600 dark:hover:ring-blue-400"
                :disabled="!row.original.image"
                @click="openImagePreview(row.original.image)"
              >
                <UAvatar :src="row.original.image || undefined" :alt="row.original.name || row.original.email" size="sm" />
              </button>
            </div>
          </template>
          <template #merchantAccountLabel-cell="{ row }">
            <span>{{ row.original.merchantAccount?.name || '-' }}</span>
          </template>
          <template #role-cell="{ row }">
            <span>{{ row.original.role }}</span>
          </template>
          <template #isActiveLabel-cell="{ row }">
            <span class="text-sm font-semibold" :class="row.original.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
              {{ row.original.isActiveLabel }}
            </span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-center gap-1">
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEditUser(row.original)" />
              <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :loading="deleteUserSavingId === row.original.id" @click="deleteUser(row.original)" />
            </div>
          </template>
        </UTable>
      </div>
    </UCard>

    <UModal v-model:open="createUserOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create User</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateUser" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="createUserError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="createUserError" />
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Name">
                <UInput
                  v-model="createUserName"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
              <UFormField>
                <template #label><span>Email <span class="text-rose-500">*</span></span></template>
                <UInput
                  v-model="createUserEmail"
                  type="email"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
              <UFormField label="Role">
                <select v-model="createUserRole" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="OWNER">OWNER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="STAFF">STAFF</option>
                </select>
              </UFormField>
              <UFormField label="Merchant">
                <select v-model="createUserMerchantAccountId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">-</option>
                  <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField label="Merchant Scope (multi)">
                <select v-model="createScopeMerchantIds" multiple size="4" class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField label="Branch Scope (multi)">
                <select v-model="createScopeBranchIds" multiple size="4" class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option v-for="item in branches" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
            </div>
            <label class="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input v-model="createUserIsActive" type="checkbox" class="h-4 w-4">
              Active
            </label>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreateUser">Cancel</UButton>
              <UButton color="primary" :loading="createUserSaving" @click="submitCreateUser">Create</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="editUserOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Edit User</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeEditUser" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="editUserError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="editUserError" />
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Name">
                <UInput
                  v-model="editUserName"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
              <UFormField label="Role">
                <select v-model="editUserRole" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="OWNER">OWNER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="STAFF">STAFF</option>
                </select>
              </UFormField>
              <UFormField label="Merchant">
                <select v-model="editUserMerchantAccountId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">-</option>
                  <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField label="Merchant Scope (multi)">
                <select v-model="editScopeMerchantIds" multiple size="4" class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField label="Branch Scope (multi)">
                <select v-model="editScopeBranchIds" multiple size="4" class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option v-for="item in branches" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField label="Status">
                <select v-model="editUserIsActive" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option :value="true">ACTIVE</option>
                  <option :value="false">INACTIVE</option>
                </select>
              </UFormField>
            </div>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeEditUser">Cancel</UButton>
              <UButton color="primary" :loading="editUserSaving" @click="submitEditUser">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="imagePreviewOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">User Image</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeImagePreview" />
            </div>
          </template>
          <div class="flex justify-center">
            <img
              v-if="imagePreviewUrl"
              :src="imagePreviewUrl"
              alt="User image"
              class="max-h-[70vh] w-auto rounded-lg border border-slate-200 object-contain dark:border-slate-700"
            >
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
:deep(.user-utable thead) {
  background-color: rgb(30 41 59) !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 30 !important;
}

:deep(.user-utable thead th) {
  color: rgb(203 213 225) !important;
  padding-top: 0.3rem !important;
  padding-bottom: 0.3rem !important;
}

.dark :deep(.user-utable thead) {
  background-color: rgb(15 23 42) !important;
}

.dark :deep(.user-utable thead th) {
  color: rgb(226 232 240) !important;
}

:deep(.user-utable tbody td) {
  padding-top: 0.3rem !important;
  padding-bottom: 0.3rem !important;
}
</style>
