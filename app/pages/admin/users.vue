<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({
  middleware: 'platform-admin-auth'
})
const { t } = useI18n()

type Tenant = { id: string; name: string; code: string }
type Merchant = { id: string; name: string; code: string; tenantId?: string }
type Branch = { id: string; name: string; code: string; merchantAccountId: string | null; tenantId?: string }
type ScopeAssignment = {
  id: string
  scopeType: 'MERCHANT' | 'BRANCH'
  merchantAccountId: string | null
  branchId: string | null
  merchantAccount?: { id: string; name: string; code: string } | null
  branch?: { id: string; name: string; code: string } | null
}
type UserItem = {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'
  isActive: boolean
  tenantId: string | null
  merchantAccountId: string | null
  emailVerified: string | null
  image: string | null
  createdAt: string
  updatedAt: string
  scopeAssignments?: ScopeAssignment[]
}
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number; adminCount?: number }

const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const adminCount = ref(0)
const search = ref('')

const filters = ref({
  tenantId: '',
  merchantAccountId: '',
  branchId: ''
})

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])
const items = ref<UserItem[]>([])

const createOpen = ref(false)
const createSaving = ref(false)
const createError = ref('')
const createEmail = ref('')
const createPassword = ref('')
const createUseDefaultPassword = ref(true)
const createName = ref('')
const createRole = ref<'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'>('USER')
const createIsActive = ref(true)
const createTenantId = ref('')
const createMerchantId = ref('')
const createScopeMerchantId = ref('')
const createScopeBranchId = ref('')
const createModalMerchants = ref<Merchant[]>([])
const createModalBranches = ref<Branch[]>([])

const editOpen = ref(false)
const editSaving = ref(false)
const editError = ref('')
const editUserId = ref('')
const editName = ref('')
const editRole = ref<'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'>('USER')
const editIsActive = ref(true)
const editTenantId = ref('')
const editMerchantId = ref('')
const editScopeMerchantId = ref('')
const editScopeBranchId = ref('')
const editModalMerchants = ref<Merchant[]>([])
const editModalBranches = ref<Branch[]>([])
const isHydratingEdit = ref(false)
const resetPasswordSaving = ref(false)

const deleteOpen = ref(false)
const deleteSaving = ref(false)
const deleteError = ref('')
const deleteUserId = ref('')
const deleteUserEmail = ref('')
const deleteConfirmText = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const roleOptions: Array<'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'> = ['ADMIN', 'USER', 'OWNER', 'MANAGER', 'STAFF']
const { data: authData } = useAuth()
const canManageUsers = computed(() => String(authData.value?.user?.role || '').toUpperCase() === 'ADMIN')

const merchantMap = computed(() => new Map(merchants.value.map((item) => [item.id, item.name])))
const createCanScope = computed(() => createRole.value === 'MANAGER' || createRole.value === 'STAFF')
const editCanScope = computed(() => editRole.value === 'MANAGER' || editRole.value === 'STAFF')
const createIsPortalRole = computed(() => createRole.value === 'OWNER' || createRole.value === 'MANAGER' || createRole.value === 'STAFF')
const editIsPortalRole = computed(() => editRole.value === 'OWNER' || editRole.value === 'MANAGER' || editRole.value === 'STAFF')
const inputUi = {
  root: 'w-full',
  base: 'h-10 w-full bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500'
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB')
}

function formatTimeOnly(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('en-GB')
}

const userRows = computed(() => items.value.map((item) => {
  const merchantScope = (item.scopeAssignments || []).find(s => s.scopeType === 'MERCHANT')?.merchantAccountId || ''
  const branchScope = (item.scopeAssignments || []).find(s => s.scopeType === 'BRANCH')?.branchId || ''
  const branchLabel = branchScope
    ? ((item.scopeAssignments || []).find(s => s.scopeType === 'BRANCH' && s.branchId === branchScope)?.branch?.name || '-')
    : '-'
  const scopeLabel = branchScope ? 'BRANCH' : merchantScope ? 'MERCHANT' : 'NONE'
  return {
    ...item,
    merchantAccountLabel: item.merchantAccountId ? (merchantMap.value.get(item.merchantAccountId) || item.merchantAccountId) : '-',
    branchLabel,
    emailVerifiedLabel: item.emailVerified ? 'YES' : 'NO',
    imageLabel: item.image ? 'YES' : 'NO',
    isActiveLabel: item.isActive ? 'ACTIVE' : 'INACTIVE',
    createdAtDate: formatDateOnly(item.createdAt),
    createdAtTime: formatTimeOnly(item.createdAt),
    updatedAtDate: formatDateOnly(item.updatedAt),
    updatedAtTime: formatTimeOnly(item.updatedAt),
    scopeLabel
  }
}))

const userColumns = [
  { accessorKey: 'imageLabel', header: 'Image' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'scopeLabel', header: 'Scope' },
  { accessorKey: 'merchantAccountLabel', header: 'Merchant' },
  { accessorKey: 'branchLabel', header: 'Branch' },
  { accessorKey: 'emailVerifiedLabel', header: 'EmailVerify' },
  { accessorKey: 'isActiveLabel', header: 'Status' },
  { accessorKey: 'createdAt', header: 'CreatedAt' },
  { accessorKey: 'updatedAt', header: 'UpdatedAt' },
  { accessorKey: 'actions', header: 'Actions' }
]

function scopeStateMessage(role: string, tenantId: string) {
  if (role !== 'MANAGER' && role !== 'STAFF') {
    return t('userForm.scopeOnlyForManagerStaff')
  }

  if (!tenantId) {
    return t('userForm.scopeSelectTenantFirst')
  }

  return t('userForm.scopeChooseMerchantBranch')
}

function isLastAdmin(item: UserItem) {
  return item.role === 'ADMIN' && adminCount.value <= 1
}

function editIsLastAdmin() {
  return editRole.value === 'ADMIN' && adminCount.value <= 1
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>('/api/admin/tenants', {
    query: { page: 1, pageSize: 200 }
  })
  tenants.value = response.items || []
}

async function loadMerchants() {
  const response = await $fetch<PagingResponse<Merchant>>('/api/admin/merchants', {
    query: {
      ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
      page: 1,
      pageSize: 200
    }
  })
  merchants.value = response.items || []
}

async function loadBranches() {
  const response = await $fetch<PagingResponse<Branch>>('/api/admin/branches', {
    query: {
      ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      page: 1,
      pageSize: 200
    }
  })
  branches.value = response.items || []
}

async function loadModalMerchants(tenantId: string, target: 'create' | 'edit') {
  if (!tenantId) {
    if (target === 'create') createModalMerchants.value = []
    else editModalMerchants.value = []
    return
  }
  const response = await $fetch<PagingResponse<Merchant>>('/api/admin/merchants', {
    query: { tenantId, page: 1, pageSize: 200 }
  })
  if (target === 'create') createModalMerchants.value = response.items || []
  else editModalMerchants.value = response.items || []
}

async function loadModalBranches(tenantId: string, merchantId: string, target: 'create' | 'edit') {
  if (!tenantId) {
    if (target === 'create') createModalBranches.value = []
    else editModalBranches.value = []
    return
  }
  const response = await $fetch<PagingResponse<Branch>>('/api/admin/branches', {
    query: {
      tenantId,
      ...(merchantId ? { merchantAccountId: merchantId } : {}),
      page: 1,
      pageSize: 200
    }
  })
  if (target === 'create') createModalBranches.value = response.items || []
  else editModalBranches.value = response.items || []
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<PagingResponse<UserItem>>('/api/admin/users', {
      query: {
        ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
        ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
        ...(filters.value.branchId ? { branchId: filters.value.branchId } : {}),
        ...(search.value.trim() ? { q: search.value.trim() } : {}),
        page: page.value,
        pageSize: pageSize.value
      }
    })
    items.value = response.items || []
    total.value = Number(response.total || 0)
    adminCount.value = Number(response.adminCount || 0)
  } catch (err) {
    items.value = []
    total.value = 0
    adminCount.value = 0
    error.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || 'Failed to load users'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadData()
}

function openCreate() {
  createError.value = ''
  createEmail.value = ''
  createUseDefaultPassword.value = true
  createPassword.value = ''
  createName.value = ''
  createRole.value = 'USER'
  createIsActive.value = true
  createTenantId.value = ''
  createMerchantId.value = ''
  createScopeMerchantId.value = ''
  createScopeBranchId.value = ''
  createModalMerchants.value = []
  createModalBranches.value = []
  createOpen.value = true
}

function closeCreate() {
  createOpen.value = false
  createSaving.value = false
  createError.value = ''
}

async function submitCreate() {
  if (!createEmail.value.trim()) {
    createError.value = 'Email is required'
    return
  }
  if (!createUseDefaultPassword.value && !createPassword.value.trim()) {
    createError.value = 'Password is required when default password is disabled'
    return
  }
  createSaving.value = true
  createError.value = ''
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: {
        email: createEmail.value.trim(),
        password: createUseDefaultPassword.value ? undefined : createPassword.value,
        name: createName.value.trim() || null,
        role: createRole.value,
        isActive: createIsActive.value,
        tenantId: createTenantId.value || null,
        merchantAccountId: createMerchantId.value || createScopeMerchantId.value || null,
        scopeAssignments: {
          merchantIds: createCanScope.value && createScopeMerchantId.value ? [createScopeMerchantId.value] : [],
          branchIds: createCanScope.value && createScopeBranchId.value ? [createScopeBranchId.value] : []
        }
      }
    })
    await loadData()
    closeCreate()
  } catch (err) {
    createError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || 'Failed to create user'
  } finally {
    createSaving.value = false
  }
}

watch(createUseDefaultPassword, (enabled) => {
  if (enabled) {
    createPassword.value = ''
  }
})

async function openEdit(item: UserItem) {
  isHydratingEdit.value = true
  editError.value = ''
  editUserId.value = item.id
  editName.value = item.name || ''
  editRole.value = item.role
  editIsActive.value = item.isActive
  editTenantId.value = item.tenantId || ''
  editMerchantId.value = item.merchantAccountId || ''
  editScopeMerchantId.value = (item.scopeAssignments || [])
    .filter((s) => s.scopeType === 'MERCHANT' && s.merchantAccountId)
    .map((s) => s.merchantAccountId as string)[0] || item.merchantAccountId || ''
  editScopeBranchId.value = (item.scopeAssignments || [])
    .filter((s) => s.scopeType === 'BRANCH' && s.branchId)
    .map((s) => s.branchId as string)[0] || ''

  await loadModalMerchants(editTenantId.value, 'edit')
  await loadModalBranches(editTenantId.value, editMerchantId.value, 'edit')
  editOpen.value = true
  isHydratingEdit.value = false
}

function closeEdit() {
  editOpen.value = false
  editSaving.value = false
  editError.value = ''
}

async function submitEdit() {
  if (!editUserId.value) return
  editSaving.value = true
  editError.value = ''
  try {
    await $fetch(`/api/admin/users/${editUserId.value}`, {
      method: 'PATCH',
      body: {
        name: editName.value.trim() || null,
        role: editRole.value,
        isActive: editIsActive.value,
        tenantId: editTenantId.value || null,
        merchantAccountId: editMerchantId.value || null,
        scopeAssignments: {
          merchantIds: editCanScope.value && editScopeMerchantId.value ? [editScopeMerchantId.value] : [],
          branchIds: editCanScope.value && editScopeBranchId.value ? [editScopeBranchId.value] : []
        }
      }
    })
    await loadData()
    closeEdit()
  } catch (err) {
    editError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || 'Failed to update user'
  } finally {
    editSaving.value = false
  }
}

async function resetEditPassword() {
  if (!editUserId.value) return
  resetPasswordSaving.value = true
  editError.value = ''
  try {
    await $fetch(`/api/admin/users/${editUserId.value}/reset-password`, {
      method: 'POST'
    })
  } catch (err) {
    editError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || 'Failed to reset password'
  } finally {
    resetPasswordSaving.value = false
  }
}

function openDelete(item: UserItem) {
  deleteError.value = ''
  deleteUserId.value = item.id
  deleteUserEmail.value = item.email
  deleteConfirmText.value = ''
  deleteOpen.value = true
}

function closeDelete() {
  deleteOpen.value = false
  deleteSaving.value = false
  deleteError.value = ''
}

async function submitDelete() {
  if (!deleteUserId.value) return
  if (deleteConfirmText.value.trim().toUpperCase() !== 'DELETE') {
    deleteError.value = 'Please type DELETE to confirm deletion'
    return
  }
  deleteSaving.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/admin/users/${deleteUserId.value}`, {
      method: 'DELETE',
      body: {
        confirmText: 'DELETE',
        confirmName: deleteUserEmail.value
      }
    })
    await loadData()
    closeDelete()
  } catch (err) {
    deleteError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || 'Failed to delete user'
  } finally {
    deleteSaving.value = false
  }
}

watch(
  () => filters.value.tenantId,
  async () => {
    filters.value.merchantAccountId = ''
    filters.value.branchId = ''
    await Promise.all([loadMerchants(), loadBranches()])
    applyFilters()
  }
)

watch(
  () => filters.value.merchantAccountId,
  async () => {
    filters.value.branchId = ''
    await loadBranches()
    applyFilters()
  }
)

watch(
  () => filters.value.branchId,
  () => {
    applyFilters()
  }
)

watch(
  () => createTenantId.value,
  async () => {
    createMerchantId.value = ''
    createScopeMerchantId.value = ''
    createScopeBranchId.value = ''
    await loadModalMerchants(createTenantId.value, 'create')
    await loadModalBranches(createTenantId.value, '', 'create')
  }
)

watch(
  () => createMerchantId.value,
  async () => {
    await loadModalBranches(createTenantId.value, createMerchantId.value, 'create')
  }
)

watch(
  () => createScopeMerchantId.value,
  async () => {
    createMerchantId.value = createScopeMerchantId.value
    createScopeBranchId.value = ''
    await loadModalBranches(createTenantId.value, createScopeMerchantId.value, 'create')
  }
)

watch(
  () => editRole.value,
  (role) => {
    if (isHydratingEdit.value) return
    if (role === 'ADMIN' || role === 'USER') {
      editTenantId.value = ''
      editMerchantId.value = ''
      editScopeMerchantId.value = ''
      editScopeBranchId.value = ''
      editModalMerchants.value = []
      editModalBranches.value = []
    }
  }
)

watch(
  () => editTenantId.value,
  async () => {
    if (isHydratingEdit.value) return
    editMerchantId.value = ''
    editScopeMerchantId.value = ''
    editScopeBranchId.value = ''
    await loadModalMerchants(editTenantId.value, 'edit')
    await loadModalBranches(editTenantId.value, '', 'edit')
  }
)

watch(
  () => editMerchantId.value,
  async () => {
    if (isHydratingEdit.value) return
    if (!editMerchantId.value) {
      editScopeMerchantId.value = ''
      editScopeBranchId.value = ''
    } else {
      editScopeBranchId.value = ''
    }
    await loadModalBranches(editTenantId.value, editMerchantId.value, 'edit')
  }
)

watch(
  () => editScopeMerchantId.value,
  async () => {
    if (isHydratingEdit.value) return
    editScopeBranchId.value = ''
    await loadModalBranches(editTenantId.value, editScopeMerchantId.value, 'edit')
  }
)

watch(
  () => createCanScope.value,
  (canScope) => {
    if (!canScope) {
      createScopeMerchantId.value = ''
      createScopeBranchId.value = ''
    }
  }
)

watch(
  () => editCanScope.value,
  (canScope) => {
    if (!canScope) {
      editScopeMerchantId.value = ''
      editScopeBranchId.value = ''
    } else {
      // For MANAGER/STAFF, use scope assignments as single source of truth.
      // Clear base merchant to avoid duplicated/ambiguous scope definition.
      editMerchantId.value = ''
    }
  }
)

onMounted(async () => {
  await Promise.all([loadTenants(), loadMerchants(), loadBranches()])
  await loadData()
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-[240px]">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">User Management
          </p>
          <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Platform Users</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Manage platform and portal user access</p>
        </div>

        <div class="flex flex-1 flex-wrap items-start justify-end gap-3">
          <div class="flex w-[220px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Tenant</label>
            <select v-model="filters.tenantId"
              class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="">All tenants</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
            </select>
          </div>

          <div class="flex w-[260px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Merchant (Brand)</label>
            <select v-model="filters.merchantAccountId"
              class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="">All merchant (brand)</option>
              <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">{{ merchant.name }}</option>
            </select>
          </div>

          <div class="flex w-[240px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Branch</label>
            <select v-model="filters.branchId"
              class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="">All branches</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
            </select>
          </div>

          <div class="flex w-[280px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Search</label>
            <SearchInput v-model="search" placeholder="Search email/name..." @enter="applyFilters" />
          </div>

          <div class="flex h-10 items-center self-end gap-2">
            <UButton v-if="canManageUsers" icon="i-lucide-plus" color="primary" class="text-white" @click="openCreate">Create</UButton>
            <UButton icon="i-lucide-refresh-cw" color="neutral" variant="soft" @click="loadData">Refresh</UButton>
          </div>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ root: 'h-[620px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">User Access</p>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ total }} users</p>
      </div>
      <div v-if="loading" class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
      <UserAccessTable
        v-else
        :rows="userRows"
        :columns="userColumns"
        :can-manage-users="canManageUsers"
        :delete-disabled-ids="userRows.filter((row) => isLastAdmin(row)).map((row) => row.id)"
        @edit="openEdit"
        @delete="openDelete"
      />

      <div class="mt-4 flex items-center justify-between text-sm">
        <p class="text-slate-500 dark:text-slate-400">Showing {{ items.length }} of {{ total }} users</p>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-chevron-left" color="neutral" variant="soft" :disabled="page <= 1"
            @click="page -= 1; loadData()" />
          <span class="text-xs text-slate-500 dark:text-slate-400">Page {{ page }} / {{ totalPages }}</span>
          <UButton icon="i-lucide-chevron-right" color="neutral" variant="soft" :disabled="page >= totalPages"
            @click="page += 1; loadData()" />
        </div>
      </div>
    </UCard>

    <UModal v-model:open="createOpen" :ui="{ content: 'sm:max-w-4xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create User</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreate" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="createError" color="error" variant="soft" icon="i-lucide-alert-triangle"
              :title="createError" />

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label><span>Email <span class="text-rose-500">*</span></span></template>
                <UInput v-model="createEmail" class="h-10 w-full" placeholder="user@example.com" :ui="inputUi" />
              </UFormField>
              <UFormField>
                <template #label>
                  <div class="flex items-center justify-between gap-3">
                    <span>Password <span class="text-rose-500">*</span></span>
                    <label
                      class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      <input v-model="createUseDefaultPassword" type="checkbox"
                        class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-800" />
                      <span>Default password</span>
                    </label>
                  </div>
                </template>
                <UInput v-model="createPassword" class="h-10 w-full" type="password" placeholder="At least 8 characters"
                  :disabled="createUseDefaultPassword" :ui="inputUi" />
              </UFormField>
            </div>

            <UFormField label="Name">
              <UInput v-model="createName" class="h-10 w-full" placeholder="Display name" :ui="inputUi" />
            </UFormField>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label><span>Role <span class="text-rose-500">*</span></span></template>
                <select v-model="createRole"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
                </select>
              </UFormField>
              <UFormField>
                <template #label><span>Status <span class="text-rose-500">*</span></span></template>
                <select v-model="createIsActive"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option :value="true">ACTIVE</option>
                  <option :value="false">INACTIVE</option>
                </select>
              </UFormField>
            </div>

            <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div class="grid gap-3 sm:grid-cols-3">
                <UFormField :label="t('userForm.tenantOptional')">
                  <select v-model="createTenantId"
                    class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                    <option value="">None</option>
                    <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
                  </select>
                </UFormField>
                <UFormField :label="t('userForm.merchantOptional')">
                  <select v-model="createScopeMerchantId"
                    class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                    :disabled="!createTenantId">
                    <option value="">None</option>
                    <option v-for="merchant in createModalMerchants" :key="merchant.id" :value="merchant.id">{{
                      merchant.name }}
                    </option>
                  </select>
                </UFormField>
                <UFormField :label="t('userForm.scopeBranchOptional')">
                  <select v-model="createScopeBranchId"
                    class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                    :disabled="!createTenantId || !createScopeMerchantId">
                    <option value="">None</option>
                    <option
                      v-for="branch in createModalBranches.filter((b) => b.merchantAccountId === createScopeMerchantId)"
                      :key="branch.id" :value="branch.id">{{ branch.name }}</option>
                  </select>
                </UFormField>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreate">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="createSaving" @click="submitCreate">Create</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="editOpen" :ui="{ content: 'sm:max-w-4xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Edit User</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeEdit" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="editError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="editError" />

            <UFormField label="Name">
              <UInput v-model="editName" class="w-full h-10" placeholder="Display name" :ui="inputUi" />
            </UFormField>

            <div class="grid gap-3 sm:grid-cols-3">
              <UFormField>
                <template #label><span>Role <span class="text-rose-500">*</span></span></template>
                <select v-model="editRole"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option v-for="role in roleOptions" :key="role" :value="role"
                    :disabled="editIsLastAdmin() && role !== 'ADMIN'">
                    {{ role }}
                  </option>
                </select>
              </UFormField>
              <UFormField>
                <template #label><span>Status <span class="text-rose-500">*</span></span></template>
                <select v-model="editIsActive"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option :value="true">ACTIVE</option>
                  <option :value="false" :disabled="editIsLastAdmin()">INACTIVE</option>
                </select>
              </UFormField>
              <UFormField v-if="editIsPortalRole" :label="editCanScope ? 'Tenant' : t('userForm.tenantOptional')">
                <select v-model="editTenantId"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">None</option>
                  <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
                </select>
              </UFormField>
            </div>

            <UFormField v-if="editIsPortalRole && !editCanScope" :label="t('userForm.merchantOptional')">
              <select v-model="editMerchantId"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                :disabled="!editTenantId">
                <option value="">None</option>
                <option v-for="merchant in editModalMerchants" :key="merchant.id" :value="merchant.id">{{ merchant.name
                  }}
                </option>
              </select>
            </UFormField>

            <div v-if="editIsPortalRole" class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p class="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('userForm.scopeAssignmentsManagerStaff') }}
              </p>
              <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">
                {{ scopeStateMessage(editRole, editTenantId) }}
                <span class="block">{{ t('userForm.scopeEffectiveOverride') }}</span>
              </p>
              <div class="grid gap-3 sm:grid-cols-2">
                <UFormField :label="t('userForm.scopeMerchant')">
                  <select v-model="editScopeMerchantId"
                    class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                    :disabled="!editCanScope || !editTenantId">
                    <option value="">None</option>
                    <option v-for="merchant in editModalMerchants" :key="merchant.id" :value="merchant.id">{{
                      merchant.name }}
                    </option>
                  </select>
                </UFormField>
                <UFormField :label="t('userForm.scopeBranchOptional')">
                  <select v-model="editScopeBranchId"
                    class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                    :disabled="!editCanScope || !editTenantId || !editScopeMerchantId">
                    <option value="">None</option>
                    <option
                      v-for="branch in editModalBranches.filter((b) => b.merchantAccountId === editScopeMerchantId)"
                      :key="branch.id" :value="branch.id">{{ branch.name }}</option>
                  </select>
                </UFormField>
              </div>
            </div>

            <UAlert v-if="editIsLastAdmin()" color="warning" variant="soft" icon="i-lucide-shield-alert"
              title="This is the last platform admin."
              description="Role downgrade and inactive status are disabled to keep platform administration reachable." />
          </div>

          <template #footer>
            <div class="flex w-full items-center justify-between gap-2">
              <UButton color="warning" variant="soft" icon="i-lucide-key-round" :loading="resetPasswordSaving"
                :disabled="!editUserId" @click="resetEditPassword">
                Reset Password
              </UButton>
              <div class="flex items-center gap-2">
                <UButton color="neutral" variant="soft" @click="closeEdit">Cancel</UButton>
                <UButton color="primary" class="text-white" :loading="editSaving" @click="submitEdit">Save</UButton>
              </div>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Delete User</h3>
          </template>

          <div class="space-y-3">
            <UAlert v-if="deleteError" color="error" variant="soft" icon="i-lucide-alert-triangle"
              :title="deleteError" />
            <p class="text-sm text-slate-700 dark:text-slate-200">Delete confirmation requires `DELETE`.</p>
            <p class="text-sm text-slate-700 dark:text-slate-200">Target user: <span
                class="font-semibold text-slate-900 dark:text-slate-100">{{ deleteUserEmail }}</span></p>
            <UInput v-model="deleteConfirmText" placeholder="Type DELETE" :ui="inputUi" />
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeDelete">Cancel</UButton>
              <UButton color="error" :loading="deleteSaving" @click="submitDelete">Delete</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
