<script setup lang="ts">
import { onMounted, ref } from 'vue'

definePageMeta({ middleware: 'portal-auth' })

type ProductTypeRow = {
  code: string
  name: string
  sortOrder: number
  active: boolean
  linkedProducts: number
  canDelete: boolean
}

type ServiceModeRow = {
  code: string
  name: string
  sortOrder: number
  active: boolean
  canDelete?: boolean
}

type ServiceUnitRow = {
  code: string
  name: string
  symbol: string | null
  sortOrder: number
  active: boolean
  canDelete?: boolean
}

const loading = ref(false)
const saving = ref(false)
const error = ref('')

const createTypeOpen = ref(false)
const createModeOpen = ref(false)
const createUnitOpen = ref(false)
const editTypeOpen = ref(false)
const editModeOpen = ref(false)
const editUnitOpen = ref(false)

const productTypeRows = ref<ProductTypeRow[]>([])
const serviceModeRows = ref<ServiceModeRow[]>([])
const serviceUnitRows = ref<ServiceUnitRow[]>([])

const typeDraft = ref({ code: '', name: '', sortOrder: 100, active: true })
const modeDraft = ref({ code: '', name: '', sortOrder: 100, active: true })
const unitDraft = ref({ code: '', name: '', symbol: '', sortOrder: 100, active: true })
const typeEdit = ref<ProductTypeRow | null>(null)
const modeEdit = ref<ServiceModeRow | null>(null)
const unitEdit = ref<ServiceUnitRow | null>(null)

const productTypeColumns = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'sortOrder', header: 'Sort' },
  { accessorKey: 'active', header: 'Status' },
  { accessorKey: 'linkedProducts', header: 'Linked' },
  { accessorKey: 'actions', header: 'Action' }
]
const serviceModeColumns = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'sortOrder', header: 'Sort' },
  { accessorKey: 'active', header: 'Status' },
  { accessorKey: 'actions', header: 'Action' }
]
const serviceUnitColumns = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'symbol', header: 'Symbol' },
  { accessorKey: 'sortOrder', header: 'Sort' },
  { accessorKey: 'active', header: 'Status' },
  { accessorKey: 'actions', header: 'Action' }
]

const tableUi = {
  thead: 'bg-slate-800',
  tbody: 'bg-slate-950',
  tr: 'border-b border-slate-800',
  th: 'text-white text-sm font-semibold',
  td: 'text-slate-100'
}

const fieldUi = {
  base: 'bg-slate-800 text-slate-100 placeholder:text-slate-400 ring-1 ring-slate-600'
}

const modalUi = {
  content: 'bg-slate-950 text-slate-100 ring-1 ring-slate-800',
  header: 'bg-slate-950 text-slate-100 border-b border-slate-800',
  body: 'bg-slate-950 text-slate-100',
  footer: 'bg-slate-950 border-t border-slate-800'
}

function setError(err: unknown) {
  const fetchErr = err as { data?: { statusMessage?: string }; message?: string } | undefined
  error.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Request failed'
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [types, modes, units] = await Promise.all([
      $fetch<{ items: ProductTypeRow[] }>('/api/admin/product-types'),
      $fetch<{ items: ServiceModeRow[] }>('/api/admin/service-modes'),
      $fetch<{ items: ServiceUnitRow[] }>('/api/admin/service-units')
    ])
    productTypeRows.value = types.items || []
    serviceModeRows.value = modes.items || []
    serviceUnitRows.value = units.items || []
  } catch (err) {
    productTypeRows.value = []
    serviceModeRows.value = []
    serviceUnitRows.value = []
    setError(err)
  } finally {
    loading.value = false
  }
}

function openCreateType() {
  typeDraft.value = { code: '', name: '', sortOrder: 100, active: true }
  createTypeOpen.value = true
}

function openCreateMode() {
  modeDraft.value = { code: '', name: '', sortOrder: 100, active: true }
  createModeOpen.value = true
}

function openCreateUnit() {
  unitDraft.value = { code: '', name: '', symbol: '', sortOrder: 100, active: true }
  createUnitOpen.value = true
}

async function createType() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/product-types', { method: 'POST', body: typeDraft.value })
    createTypeOpen.value = false
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

async function createMode() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/service-modes', { method: 'POST', body: modeDraft.value })
    createModeOpen.value = false
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

async function createUnit() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/service-units', {
      method: 'POST',
      body: { ...unitDraft.value, symbol: unitDraft.value.symbol || null }
    })
    createUnitOpen.value = false
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

function openEditType(row: ProductTypeRow) {
  typeEdit.value = { ...row }
  editTypeOpen.value = true
}

function openEditMode(row: ServiceModeRow) {
  modeEdit.value = { ...row }
  editModeOpen.value = true
}

function openEditUnit(row: ServiceUnitRow) {
  unitEdit.value = { ...row }
  editUnitOpen.value = true
}

async function submitEditType() {
  if (!typeEdit.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/product-types/${encodeURIComponent(typeEdit.value.code)}`, {
      method: 'PATCH',
      body: typeEdit.value
    })
    editTypeOpen.value = false
    typeEdit.value = null
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

async function submitEditMode() {
  if (!modeEdit.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/service-modes/${encodeURIComponent(modeEdit.value.code)}`, {
      method: 'PATCH',
      body: modeEdit.value
    })
    editModeOpen.value = false
    modeEdit.value = null
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

async function submitEditUnit() {
  if (!unitEdit.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/service-units/${encodeURIComponent(unitEdit.value.code)}`, {
      method: 'PATCH',
      body: unitEdit.value
    })
    editUnitOpen.value = false
    unitEdit.value = null
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

async function deleteType(row: ProductTypeRow) {
  if (!row.canDelete) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/product-types/${encodeURIComponent(row.code)}`, { method: 'DELETE' })
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

async function deleteMode(row: ServiceModeRow) {
  if (row.canDelete === false) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/service-modes/${encodeURIComponent(row.code)}`, { method: 'DELETE' })
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

async function deleteUnit(row: ServiceUnitRow) {
  if (row.canDelete === false) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/service-units/${encodeURIComponent(row.code)}`, { method: 'DELETE' })
    await loadAll()
  } catch (err) {
    setError(err)
  } finally {
    saving.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <section class="space-y-4 text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-white">Product Taxonomy Management</h1>
      <p class="text-sm text-slate-300">Manage product type, service mode, and service unit catalogs.</p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" :title="error" />

    <div class="grid gap-4 lg:grid-cols-2">
      <UCard class="bg-slate-950 ring-1 ring-slate-800">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-white">Product Types</h2>
            <UButton icon="i-lucide-plus" size="sm" color="primary" class="text-white" @click="openCreateType">Create</UButton>
          </div>
        </template>
        <UTable :data="productTypeRows" :columns="productTypeColumns" :loading="loading" :ui="tableUi">
          <template #active-cell="{ row }">
            <span :class="row.original.active ? 'text-emerald-400' : 'text-rose-400'">
              {{ row.original.active ? 'ACTIVE' : 'DISABLED' }}
            </span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                class="text-slate-100 hover:text-white"
                @click="openEditType(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                class="text-rose-400 hover:text-rose-300 disabled:text-slate-500"
                :disabled="!row.original.canDelete"
                @click="deleteType(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <UCard class="bg-slate-950 ring-1 ring-slate-800">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-white">Service Modes</h2>
            <UButton icon="i-lucide-plus" size="sm" color="primary" class="text-white" @click="openCreateMode">Create</UButton>
          </div>
        </template>
        <UTable :data="serviceModeRows" :columns="serviceModeColumns" :loading="loading" :ui="tableUi">
          <template #active-cell="{ row }">
            <span :class="row.original.active ? 'text-emerald-400' : 'text-rose-400'">
              {{ row.original.active ? 'ACTIVE' : 'DISABLED' }}
            </span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                class="text-slate-100 hover:text-white"
                @click="openEditMode(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                class="text-rose-400 hover:text-rose-300 disabled:text-slate-500"
                :disabled="row.original.canDelete === false"
                @click="deleteMode(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <UCard class="bg-slate-950 ring-1 ring-slate-800 lg:col-span-2">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-white">Service Units</h2>
            <UButton icon="i-lucide-plus" size="sm" color="primary" class="text-white" @click="openCreateUnit">Create</UButton>
          </div>
        </template>
        <UTable :data="serviceUnitRows" :columns="serviceUnitColumns" :loading="loading" :ui="tableUi">
          <template #symbol-cell="{ row }">
            <span class="text-slate-100">{{ row.original.symbol || '-' }}</span>
          </template>
          <template #active-cell="{ row }">
            <span :class="row.original.active ? 'text-emerald-400' : 'text-rose-400'">
              {{ row.original.active ? 'ACTIVE' : 'DISABLED' }}
            </span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                class="text-slate-100 hover:text-white"
                @click="openEditUnit(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                class="text-rose-400 hover:text-rose-300 disabled:text-slate-500"
                :disabled="row.original.canDelete === false"
                @click="deleteUnit(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UCard>
    </div>

    <UModal v-model:open="createTypeOpen" title="Create Product Type" :ui="modalUi">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Code">
            <UInput v-model="typeDraft.code" class="w-full" :ui="fieldUi" />
          </UFormField>
          <UFormField label="Name">
            <UInput v-model="typeDraft.name" class="w-full" :ui="fieldUi" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Sort">
              <UInput v-model.number="typeDraft.sortOrder" type="number" class="w-full" :ui="fieldUi" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="typeDraft.active"
                :items="[
                  { label: 'ACTIVE', value: true },
                  { label: 'DISABLED', value: false }
                ]"
                class="w-full"
                :ui="fieldUi"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="createTypeOpen = false">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="createType">Create</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="createModeOpen" title="Create Service Mode" :ui="modalUi">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Code">
            <UInput v-model="modeDraft.code" class="w-full" :ui="fieldUi" />
          </UFormField>
          <UFormField label="Name">
            <UInput v-model="modeDraft.name" class="w-full" :ui="fieldUi" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Sort">
              <UInput v-model.number="modeDraft.sortOrder" type="number" class="w-full" :ui="fieldUi" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="modeDraft.active"
                :items="[
                  { label: 'ACTIVE', value: true },
                  { label: 'DISABLED', value: false }
                ]"
                class="w-full"
                :ui="fieldUi"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="createModeOpen = false">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="createMode">Create</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="createUnitOpen" title="Create Service Unit" :ui="modalUi">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Code">
            <UInput v-model="unitDraft.code" class="w-full" :ui="fieldUi" />
          </UFormField>
          <UFormField label="Name">
            <UInput v-model="unitDraft.name" class="w-full" :ui="fieldUi" />
          </UFormField>
          <UFormField label="Symbol">
            <UInput v-model="unitDraft.symbol" class="w-full" :ui="fieldUi" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Sort">
              <UInput v-model.number="unitDraft.sortOrder" type="number" class="w-full" :ui="fieldUi" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="unitDraft.active"
                :items="[
                  { label: 'ACTIVE', value: true },
                  { label: 'DISABLED', value: false }
                ]"
                class="w-full"
                :ui="fieldUi"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="createUnitOpen = false">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="createUnit">Create</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="editTypeOpen" title="Edit Product Type" :ui="modalUi">
      <template #body>
        <div v-if="typeEdit" class="space-y-3">
          <UFormField label="Code">
            <UInput v-model="typeEdit.code" disabled class="w-full" :ui="fieldUi" />
          </UFormField>
          <UFormField label="Name">
            <UInput v-model="typeEdit.name" class="w-full" :ui="fieldUi" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Sort">
              <UInput v-model.number="typeEdit.sortOrder" type="number" class="w-full" :ui="fieldUi" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="typeEdit.active"
                :items="[
                  { label: 'ACTIVE', value: true },
                  { label: 'DISABLED', value: false }
                ]"
                class="w-full"
                :ui="fieldUi"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="editTypeOpen = false">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="submitEditType">Save</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="editModeOpen" title="Edit Service Mode" :ui="modalUi">
      <template #body>
        <div v-if="modeEdit" class="space-y-3">
          <UFormField label="Code">
            <UInput v-model="modeEdit.code" disabled class="w-full" :ui="fieldUi" />
          </UFormField>
          <UFormField label="Name">
            <UInput v-model="modeEdit.name" class="w-full" :ui="fieldUi" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Sort">
              <UInput v-model.number="modeEdit.sortOrder" type="number" class="w-full" :ui="fieldUi" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="modeEdit.active"
                :items="[
                  { label: 'ACTIVE', value: true },
                  { label: 'DISABLED', value: false }
                ]"
                class="w-full"
                :ui="fieldUi"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="editModeOpen = false">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="submitEditMode">Save</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="editUnitOpen" title="Edit Service Unit" :ui="modalUi">
      <template #body>
        <div v-if="unitEdit" class="space-y-3">
          <UFormField label="Code">
            <UInput v-model="unitEdit.code" disabled class="w-full" :ui="fieldUi" />
          </UFormField>
          <UFormField label="Name">
            <UInput v-model="unitEdit.name" class="w-full" :ui="fieldUi" />
          </UFormField>
          <UFormField label="Symbol">
            <UInput v-model="unitEdit.symbol" class="w-full" :ui="fieldUi" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Sort">
              <UInput v-model.number="unitEdit.sortOrder" type="number" class="w-full" :ui="fieldUi" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="unitEdit.active"
                :items="[
                  { label: 'ACTIVE', value: true },
                  { label: 'DISABLED', value: false }
                ]"
                class="w-full"
                :ui="fieldUi"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="editUnitOpen = false">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="submitEditUnit">Save</UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
