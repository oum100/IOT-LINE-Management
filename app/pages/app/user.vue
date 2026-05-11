<script setup lang="ts">
definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})
const { t } = useI18n()

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
const createUserPassword = ref('')
const createUseDefaultPassword = ref(true)
const createUserName = ref('')
const createUserRole = ref<'OWNER' | 'MANAGER' | 'STAFF'>('STAFF')
const createUserMerchantAccountId = ref('')
const createScopeMerchantId = ref('')
const createScopeBranchId = ref('')
const createUserIsActive = ref(true)
const editUserOpen = ref(false)
const editUserSaving = ref(false)
const editUserError = ref('')
const editUserId = ref('')
const editUserName = ref('')
const editUserRole = ref<'OWNER' | 'MANAGER' | 'STAFF'>('STAFF')
const editUserMerchantAccountId = ref('')
const editScopeMerchantId = ref('')
const editScopeBranchId = ref('')
const editUserIsActive = ref(true)
const resetPasswordSaving = ref(false)
const deleteUserSavingId = ref('')
const imagePreviewOpen = ref(false)
const imagePreviewUrl = ref('')

const { data: governanceData, pending: governancePending, refresh: refreshGovernance } = await useFetch<GovernanceResponse>('/api/app/governance')
const { data: tenantData } = await useFetch<TenantDetailResponse>('/api/app/tenant')
const { data: authData } = useAuth()
const canResetPassword = computed(() => String(authData.value?.user?.role || '').toUpperCase() === 'OWNER')
const canManageUsers = computed(() => {
  const role = String(authData.value?.user?.role || '').toUpperCase()
  return role === 'OWNER' || role === 'ADMIN'
})

const tenantName = computed(() => tenantData.value?.tenant?.name || '-')
const tenantCode = computed(() => tenantData.value?.tenant?.code || '-')
const merchants = computed(() => tenantData.value?.merchants || [])
const branches = computed(() => tenantData.value?.branches || [])
const governanceUsers = computed(() => governanceData.value?.users || [])

const governanceUserRows = computed(() => governanceUsers.value.map((item) => {
  const merchantScope = item.scopeAssignments.find(s => s.scopeType === 'MERCHANT')?.merchantAccountId || ''
  const branchScope = item.scopeAssignments.find(s => s.scopeType === 'BRANCH')?.branchId || ''
  const branchName = branchScope ? (branches.value.find(b => b.id === branchScope)?.name || '-') : '-'
  const scopeLabel = branchScope ? 'BRANCH' : merchantScope ? 'MERCHANT' : 'NONE'
  return {
    ...item,
    merchantAccountLabel: item.merchantAccount?.name || (merchantScope ? (merchants.value.find(m => m.id === merchantScope)?.name || '-') : '-'),
    branchLabel: branchName,
    emailVerifiedLabel: item.emailVerified ? 'YES' : 'NO',
    imageLabel: item.image ? 'YES' : 'NO',
    createdAtLabel: formatDateTime(item.createdAt),
    createdAtDate: formatDate(item.createdAt),
    createdAtTime: formatTime(item.createdAt),
    updatedAtLabel: formatDateTime(item.updatedAt),
    updatedAtDate: formatDate(item.updatedAt),
    updatedAtTime: formatTime(item.updatedAt),
    isActiveLabel: item.isActive ? 'ACTIVE' : 'INACTIVE',
    scopeLabel
  }
}))

const governanceUserColumns = [
  { accessorKey: 'imageLabel', header: 'Image' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'scopeLabel', header: 'Scope' },
  { accessorKey: 'merchantAccountLabel', header: 'Merchant' },
  { accessorKey: 'branchLabel', header: 'Branch' },
  { accessorKey: 'emailVerifiedLabel', header: 'EmailVerify' },
  { accessorKey: 'isActiveLabel', header: 'Status' },
  { accessorKey: 'createdAtLabel', header: 'CreatedAt' },
  { accessorKey: 'updatedAtLabel', header: 'UpdatedAt' },
  { accessorKey: 'actions', header: 'Actions' }
]
const inputUi = {
  root: 'w-full',
  base: 'h-10 w-full bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500'
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-GB')
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB')
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('en-GB')
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
  createUserPassword.value = ''
  createUseDefaultPassword.value = true
  createUserName.value = ''
  createUserRole.value = 'STAFF'
  createUserMerchantAccountId.value = ''
  createScopeMerchantId.value = ''
  createScopeBranchId.value = ''
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
        password: createUseDefaultPassword.value ? undefined : (createUserPassword.value.trim() || undefined),
        name: createUserName.value.trim() || null,
        role: createUserRole.value,
        merchantAccountId: createUserMerchantAccountId.value || null,
        scopeAssignments: {
          merchantIds: createScopeMerchantId.value ? [createScopeMerchantId.value] : [],
          branchIds: createScopeBranchId.value ? [createScopeBranchId.value] : []
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
  editScopeMerchantId.value = raw?.scopeAssignments.find(s => s.scopeType === 'MERCHANT')?.merchantAccountId || item.merchantAccountId || ''
  editScopeBranchId.value = raw?.scopeAssignments.find(s => s.scopeType === 'BRANCH')?.branchId || ''
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
          merchantIds: editScopeMerchantId.value ? [editScopeMerchantId.value] : [],
          branchIds: editScopeBranchId.value ? [editScopeBranchId.value] : []
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

async function resetEditUserPassword() {
  if (!editUserId.value || !canResetPassword.value) return
  resetPasswordSaving.value = true
  editUserError.value = ''
  try {
    await $fetch(`/api/app/users/${editUserId.value}/reset-password`, {
      method: 'POST'
    })
  } catch (err) {
    editUserError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to reset password'
  } finally {
    resetPasswordSaving.value = false
  }
}

watch(editUserMerchantAccountId, (value) => {
  if (!value) {
    editScopeMerchantId.value = ''
    editScopeBranchId.value = ''
  }
})

watch(createScopeMerchantId, () => {
  createScopeBranchId.value = ''
})

watch(createUseDefaultPassword, (enabled) => {
  if (enabled) createUserPassword.value = ''
})

watch(editScopeMerchantId, () => {
  editScopeBranchId.value = ''
})

watch(createUserRole, (role) => {
  if (role === 'OWNER') {
    createScopeMerchantId.value = ''
    createScopeBranchId.value = ''
  } else {
    createUserMerchantAccountId.value = ''
  }
})

watch(editUserRole, (role) => {
  if (role === 'OWNER') {
    editScopeMerchantId.value = ''
    editScopeBranchId.value = ''
  } else {
    editUserMerchantAccountId.value = ''
  }
})

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
          <UButton v-if="canManageUsers" icon="i-lucide-plus" color="primary" class="text-white" size="xs" @click="openCreateUser">Create</UButton>
        </div>
      </div>
      <div v-if="governanceUserError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{{ governanceUserError }}</div>
      <div v-if="governancePending" class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
      <UserAccessTable
        v-else
        :rows="governanceUserRows"
        :columns="governanceUserColumns"
        :can-manage-users="canManageUsers"
        :delete-loading-id="deleteUserSavingId"
        @edit="openEditUser"
        @delete="deleteUser"
        @preview-image="openImagePreview"
      />
    </UCard>

    <UModal v-model:open="createUserOpen" :ui="{ content: 'sm:max-w-4xl' }">
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
              <UFormField>
                <template #label><span>Email <span class="text-rose-500">*</span></span></template>
                <UInput
                  v-model="createUserEmail"
                  type="email"
                  class="h-10 w-full"
                  :ui="inputUi"
                />
              </UFormField>
              <UFormField>
                <template #label>
                  <div class="flex items-center justify-between gap-3">
                    <span>Password</span>
                    <label class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      <input v-model="createUseDefaultPassword" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-800" />
                      <span>Default password</span>
                    </label>
                  </div>
                </template>
                <UInput
                  v-model="createUserPassword"
                  type="password"
                  class="h-10 w-full"
                  placeholder="Leave blank for default"
                  :disabled="createUseDefaultPassword"
                  :ui="inputUi"
                />
              </UFormField>
            </div>
            <UFormField label="Name">
              <UInput
                v-model="createUserName"
                class="h-10 w-full"
                :ui="inputUi"
              />
            </UFormField>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Role">
                <select v-model="createUserRole" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="OWNER">OWNER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="STAFF">STAFF</option>
                </select>
              </UFormField>
              <UFormField label="Status">
                <select v-model="createUserIsActive" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option :value="true">ACTIVE</option>
                  <option :value="false">INACTIVE</option>
                </select>
              </UFormField>
            </div>
            <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p class="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('userForm.scopeAssignments') }}</p>
              <div class="grid gap-3 sm:grid-cols-2">
              <UFormField v-if="createUserRole === 'OWNER'" label="Merchant">
                <select v-model="createUserMerchantAccountId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">-</option>
                  <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField v-if="createUserRole !== 'OWNER'" :label="t('userForm.scopeMerchant')">
                <select v-model="createScopeMerchantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">None</option>
                  <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField v-if="createUserRole !== 'OWNER'" :label="t('userForm.scopeBranchOptional')">
                <select v-model="createScopeBranchId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100" :disabled="!createScopeMerchantId">
                  <option value="">None</option>
                  <option v-for="item in branches.filter(b => b.merchantAccountId === createScopeMerchantId)" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              </div>
            </div>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreateUser">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="createUserSaving" @click="submitCreateUser">Create</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="editUserOpen" :ui="{ content: 'sm:max-w-4xl' }">
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
            <UFormField label="Name">
              <UInput
                v-model="editUserName"
                class="h-10 w-full"
                :ui="inputUi"
              />
            </UFormField>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Role">
                <select v-model="editUserRole" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="OWNER">OWNER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="STAFF">STAFF</option>
                </select>
              </UFormField>
              <UFormField label="Status">
                <select v-model="editUserIsActive" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option :value="true">ACTIVE</option>
                  <option :value="false">INACTIVE</option>
                </select>
              </UFormField>
            </div>

            <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p class="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('userForm.scopeAssignments') }}</p>
              <div class="grid gap-3 sm:grid-cols-2">
              <UFormField v-if="editUserRole === 'OWNER'" label="Merchant">
                <select v-model="editUserMerchantAccountId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">-</option>
                  <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField v-if="editUserRole !== 'OWNER'" :label="t('userForm.scopeMerchant')">
                <select v-model="editScopeMerchantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">None</option>
                  <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              <UFormField v-if="editUserRole !== 'OWNER'" :label="t('userForm.scopeBranchOptional')">
                <select v-model="editScopeBranchId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100" :disabled="!editScopeMerchantId">
                  <option value="">None</option>
                  <option v-for="item in branches.filter(b => b.merchantAccountId === editScopeMerchantId)" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </UFormField>
              </div>
            </div>
          </div>
          <template #footer>
            <div class="flex w-full items-center justify-between gap-2">
              <UButton
                v-if="canResetPassword"
                color="warning"
                variant="soft"
                icon="i-lucide-key-round"
                :loading="resetPasswordSaving"
                :disabled="!editUserId"
                @click="resetEditUserPassword"
              >
                Reset Password
              </UButton>
              <div class="flex items-center gap-2">
              <UButton color="neutral" variant="soft" @click="closeEditUser">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="editUserSaving" @click="submitEditUser">Save</UButton>
              </div>
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
