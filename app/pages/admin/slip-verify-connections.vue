<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({
  middleware: 'platform-admin-auth'
})

type Tenant = { id: string; name: string; code: string }
type ConnectionItem = {
  id: string
  tenantId: string
  code: string
  displayName: string
  providerCode: string
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED'
  baseUrl: string | null
  appKey: string | null
  appSecret: string | null
  webhookSecret: string | null
  credentials: Record<string, unknown> | null
  linkedCount: number
  canDelete: boolean
}
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }

const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const search = ref('')

const filters = ref({
  tenantId: ''
})

const tenants = ref<Tenant[]>([])
const items = ref<ConnectionItem[]>([])

const createOpen = ref(false)
const editOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const formId = ref('')
const formTenantId = ref('')
const formDisplayName = ref('')
const formProviderCode = ref('SLIP2GO')
const formStatus = ref<'ACTIVE' | 'INACTIVE' | 'DISABLED'>('ACTIVE')
const formBaseUrl = ref('')
const formAppKey = ref('')
const formAppSecret = ref('')
const formWebhookSecret = ref('')
const formCredentialsJson = ref('')
const formPreset = ref<'CUSTOM' | 'SLIP2GO' | 'EASYSLIP' | 'OMISE'>('CUSTOM')
const formVerifyPath = ref('/verify-slip/qr-image/info')
const formVerifyMethod = ref<'POST' | 'GET'>('POST')
const formApiKeyHeader = ref('Authorization')
const formAuthType = ref<'none' | 'bearer' | 'basic'>('bearer')
const formRequestExtraHeadersJson = ref('')
const formRequestPayloadTemplateJson = ref('')
const formResponseStatusPath = ref('code')
const formResponseSuccessValues = ref('200000,200200')
const formResponseAmountPath = ref('data.amount')
const formResponseReferencePath = ref('data.transRef')

const deleteOpen = ref(false)
const deleteSaving = ref(false)
const deleteError = ref('')
const deleteId = ref('')
const deleteName = ref('')
const deleteConfirmText = ref('')
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const tenantOptions = computed(() => tenants.value.map(item => ({ label: item.name, value: item.id })))
const inputUi = {
  base: 'h-10 bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500'
}
const nativeSelectClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'
const modalUi = {
  content: 'w-full max-w-5xl bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 ring-1 ring-slate-200 dark:ring-slate-700',
  header: 'border-b border-slate-200 dark:border-slate-700',
  body: 'text-slate-900 dark:text-slate-100',
  footer: 'border-t border-slate-200 dark:border-slate-700'
}

function applySlipPreset() {
  if (formPreset.value === 'SLIP2GO') {
    formVerifyPath.value = '/verify-slip/qr-image/info'
    formVerifyMethod.value = 'POST'
    formApiKeyHeader.value = 'Authorization'
    formAuthType.value = 'bearer'
    formRequestExtraHeadersJson.value = JSON.stringify({}, null, 2)
    formRequestPayloadTemplateJson.value = JSON.stringify({
      checkCondition: {
        checkDuplicate: true,
        checkAmount: { type: 'eq', amount: '{{amount}}' }
      }
    }, null, 2)
    formResponseStatusPath.value = 'code'
    formResponseSuccessValues.value = '200000,200200'
    formResponseAmountPath.value = 'data.amount'
    formResponseReferencePath.value = 'data.transRef'
    return
  }
  if (formPreset.value === 'EASYSLIP') {
    formVerifyPath.value = '/api/v1/slips/verify'
    formVerifyMethod.value = 'POST'
    formApiKeyHeader.value = 'x-api-key'
    formAuthType.value = 'none'
    formRequestExtraHeadersJson.value = JSON.stringify({ 'x-provider': 'easyslip' }, null, 2)
    formRequestPayloadTemplateJson.value = JSON.stringify({ amount: '{{amount}}' }, null, 2)
    formResponseStatusPath.value = 'status'
    formResponseSuccessValues.value = 'SUCCESS,OK,200'
    formResponseAmountPath.value = 'data.amount'
    formResponseReferencePath.value = 'data.reference'
    return
  }
  if (formPreset.value === 'OMISE') {
    formVerifyPath.value = '/v1/slips/verify'
    formVerifyMethod.value = 'POST'
    formApiKeyHeader.value = 'Authorization'
    formAuthType.value = 'basic'
    formRequestExtraHeadersJson.value = JSON.stringify({}, null, 2)
    formRequestPayloadTemplateJson.value = JSON.stringify({ amount: '{{amount}}' }, null, 2)
    formResponseStatusPath.value = 'status'
    formResponseSuccessValues.value = 'successful,verified'
    formResponseAmountPath.value = 'data.amount'
    formResponseReferencePath.value = 'data.reference'
  }
}

function statusClass(status: string) {
  if (status === 'ACTIVE') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'INACTIVE') return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

function maskedSecret(value: string | null) {
  if (!value) return '-'
  if (value.length <= 4) return '••••'
  return `${'•'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>('/api/admin/tenants', {
    query: { page: 1, pageSize: 200 }
  })
  tenants.value = response.items || []
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<PagingResponse<ConnectionItem>>('/api/admin/slip-verify-connections', {
      query: {
        ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
        ...(search.value.trim() ? { q: search.value.trim() } : {}),
        page: page.value,
        pageSize: pageSize.value
      }
    })
    items.value = response.items || []
    total.value = Number(response.total || 0)
  } catch (err) {
    items.value = []
    total.value = 0
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Failed to load slip verify connections'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formId.value = ''
  formTenantId.value = ''
  formDisplayName.value = ''
  formProviderCode.value = 'SLIP2GO'
  formStatus.value = 'ACTIVE'
  formBaseUrl.value = ''
  formAppKey.value = ''
  formAppSecret.value = ''
  formWebhookSecret.value = ''
  formCredentialsJson.value = ''
  formPreset.value = 'CUSTOM'
  formVerifyPath.value = '/verify-slip/qr-image/info'
  formVerifyMethod.value = 'POST'
  formApiKeyHeader.value = 'Authorization'
  formAuthType.value = 'bearer'
  formRequestExtraHeadersJson.value = ''
  formRequestPayloadTemplateJson.value = ''
  formResponseStatusPath.value = 'code'
  formResponseSuccessValues.value = '200000,200200'
  formResponseAmountPath.value = 'data.amount'
  formResponseReferencePath.value = 'data.transRef'
  formError.value = ''
}

function openCreate() {
  resetForm()
  createOpen.value = true
}

function openEdit(item: ConnectionItem) {
  resetForm()
  formId.value = item.id
  formTenantId.value = item.tenantId
  formDisplayName.value = item.displayName
  formProviderCode.value = item.providerCode
  formStatus.value = item.status
  formBaseUrl.value = item.baseUrl || ''
  formAppKey.value = item.appKey || ''
  formAppSecret.value = item.appSecret || ''
  formWebhookSecret.value = item.webhookSecret || ''
  formCredentialsJson.value = item.credentials ? JSON.stringify(item.credentials, null, 2) : ''
  const cfg = item.credentials && typeof item.credentials === 'object' ? item.credentials as Record<string, any> : {}
  const verifyCfg = cfg.verifyConfig && typeof cfg.verifyConfig === 'object' ? cfg.verifyConfig : {}
  const responseCfg = cfg.responseConfig && typeof cfg.responseConfig === 'object' ? cfg.responseConfig : {}
  formVerifyPath.value = verifyCfg.path || '/verify-slip/qr-image/info'
  formVerifyMethod.value = verifyCfg.method === 'GET' ? 'GET' : 'POST'
  formApiKeyHeader.value = verifyCfg.apiKeyHeader || 'Authorization'
  formAuthType.value = verifyCfg.authType === 'basic' ? 'basic' : verifyCfg.authType === 'none' ? 'none' : 'bearer'
  formRequestExtraHeadersJson.value = verifyCfg.extraHeaders ? JSON.stringify(verifyCfg.extraHeaders, null, 2) : ''
  formRequestPayloadTemplateJson.value = verifyCfg.payloadTemplate ? JSON.stringify(verifyCfg.payloadTemplate, null, 2) : ''
  formResponseStatusPath.value = responseCfg.statusPath || 'code'
  formResponseSuccessValues.value = Array.isArray(responseCfg.successValues) ? responseCfg.successValues.join(',') : '200000,200200'
  formResponseAmountPath.value = responseCfg.amountPath || 'data.amount'
  formResponseReferencePath.value = responseCfg.referencePath || 'data.transRef'
  editOpen.value = true
}

function closeCreate() {
  createOpen.value = false
  saving.value = false
  formError.value = ''
}

function closeEdit() {
  editOpen.value = false
  saving.value = false
  formError.value = ''
}

async function submitForm(mode: 'create' | 'edit') {
  if (!formTenantId.value || !formDisplayName.value.trim()) {
    formError.value = 'Tenant and display name are required'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    let extraHeaders: Record<string, unknown> = {}
    let payloadTemplate: Record<string, unknown> = {}
    if (formRequestExtraHeadersJson.value.trim()) {
      try {
        const parsed = JSON.parse(formRequestExtraHeadersJson.value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
        extraHeaders = parsed as Record<string, unknown>
      } catch {
        formError.value = 'Verify extra headers JSON is invalid'
        saving.value = false
        return
      }
    }
    if (formRequestPayloadTemplateJson.value.trim()) {
      try {
        const parsed = JSON.parse(formRequestPayloadTemplateJson.value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
        payloadTemplate = parsed as Record<string, unknown>
      } catch {
        formError.value = 'Verify payload template JSON is invalid'
        saving.value = false
        return
      }
    }
    const manual = formCredentialsJson.value.trim()
      ? (() => {
          try {
            const parsed = JSON.parse(formCredentialsJson.value)
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
            return parsed as Record<string, unknown>
          } catch {
            return null
          }
        })()
      : {}
    if (formCredentialsJson.value.trim() && !manual) {
      formError.value = 'Advanced credentials JSON is invalid'
      saving.value = false
      return
    }
    const credentials = {
      ...(manual || {}),
      verifyConfig: {
        path: formVerifyPath.value.trim() || '/verify-slip/qr-image/info',
        method: formVerifyMethod.value,
        apiKeyHeader: formApiKeyHeader.value.trim() || 'Authorization',
        authType: formAuthType.value,
        extraHeaders,
        payloadTemplate
      },
      responseConfig: {
        statusPath: formResponseStatusPath.value.trim() || 'code',
        successValues: formResponseSuccessValues.value.split(',').map(v => v.trim()).filter(Boolean),
        amountPath: formResponseAmountPath.value.trim() || 'data.amount',
        referencePath: formResponseReferencePath.value.trim() || 'data.transRef'
      }
    }
    const payload = {
      tenantId: formTenantId.value,
      displayName: formDisplayName.value.trim(),
      providerCode: formProviderCode.value.trim(),
      status: formStatus.value,
      baseUrl: formBaseUrl.value.trim() || null,
      appKey: formAppKey.value.trim() || null,
      appSecret: formAppSecret.value.trim() || null,
      webhookSecret: formWebhookSecret.value.trim() || null,
      credentials
    }
    if (mode === 'create') {
      await $fetch('/api/admin/slip-verify-connections', { method: 'POST', body: payload })
      closeCreate()
    } else {
      await $fetch(`/api/admin/slip-verify-connections/${formId.value}`, { method: 'PATCH', body: payload })
      closeEdit()
    }
    await loadData()
  } catch (err) {
    formError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Failed to save connection'
  } finally {
    saving.value = false
  }
}

function loadDelete(item: ConnectionItem) {
  deleteId.value = item.id
  deleteName.value = item.displayName
  deleteConfirmText.value = ''
  deleteError.value = ''
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteId.value || deleteConfirmText.value.trim() !== 'DELETE') {
    deleteError.value = 'Type DELETE to confirm'
    return
  }
  deleteSaving.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/admin/slip-verify-connections/${deleteId.value}`, {
      method: 'DELETE',
      body: {
        confirmText: 'DELETE',
        confirmName: deleteName.value
      }
    })
    deleteOpen.value = false
    await loadData()
  } catch (err) {
    deleteError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Failed to delete connection'
  } finally {
    deleteSaving.value = false
  }
}

watch(() => filters.value.tenantId, async () => {
  page.value = 1
  await loadData()
})

watch(search, (value) => {
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
  searchDebounce.value = setTimeout(() => {
    page.value = 1
    void loadData()
  }, value.trim() ? 250 : 0)
})

onMounted(async () => {
  await Promise.all([loadTenants(), loadData()])
})
</script>

<template>
  <div class="space-y-4">
    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-[240px]">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Slip Verify</p>
          <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Slip Verify Connections</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Manage slip verification providers and credentials for each tenant.</p>
        </div>

        <div class="grid min-w-[320px] gap-3 sm:grid-cols-2">
          <UFormField label="Tenant">
            <select v-model="filters.tenantId" :class="nativeSelectClass">
              <option value="">All tenants</option>
              <option v-for="item in tenantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </UFormField>
          <UFormField label="Search">
            <SearchInput v-model="search" placeholder="Search code/name/provider..." />
          </UFormField>
        </div>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Connection List</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ total }} total connections</p>
        </div>
        <UButton color="primary" class="text-white" icon="i-lucide-plus" @click="openCreate">Create Connection</UButton>
      </div>

      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-200 text-left text-slate-700 dark:bg-slate-700 dark:text-slate-100">
            <tr>
              <th class="px-3 py-2">Code</th>
              <th class="px-3 py-2">Display Name</th>
              <th class="px-3 py-2">Tenant</th>
              <th class="px-3 py-2">Provider</th>
              <th class="px-3 py-2">Base URL</th>
              <th class="px-3 py-2">App Key</th>
              <th class="px-3 py-2">App Secret</th>
              <th class="px-3 py-2">Webhook Secret</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{{ item.code }}</td>
              <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ item.displayName }}</td>
              <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ tenants.find(t => t.id === item.tenantId)?.name || '-' }}</td>
              <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ item.providerCode }}</td>
              <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ item.baseUrl || '-' }}</td>
              <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ item.appKey || '-' }}</td>
              <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ maskedSecret(item.appSecret) }}</td>
              <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ maskedSecret(item.webhookSecret) }}</td>
              <td class="px-3 py-2"><span class="font-semibold" :class="statusClass(item.status)">{{ item.status }}</span></td>
              <td class="px-3 py-2">
                <div class="flex items-center justify-center gap-1">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(item)" />
                  <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :disabled="!item.canDelete" @click="loadDelete(item)" />
                </div>
              </td>
            </tr>
            <tr v-if="!loading && items.length === 0">
              <td colspan="10" class="px-3 py-6 text-center text-slate-500">No connections found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-sm text-slate-500 dark:text-slate-400">Page {{ page }} / {{ totalPages }}</p>
        <div class="flex gap-2">
          <UButton color="neutral" variant="soft" :disabled="page <= 1" @click="page -= 1; loadData()">Prev</UButton>
          <UButton color="neutral" variant="soft" :disabled="page >= totalPages" @click="page += 1; loadData()">Next</UButton>
        </div>
      </div>
    </UCard>

    <UModal v-model:open="createOpen" :ui="modalUi">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Slip Verify Connection</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreate" />
            </div>
          </template>
          <div class="space-y-4">
            <UAlert v-if="formError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="formError" />
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Tenant">
                <select v-model="formTenantId" :class="nativeSelectClass">
                  <option value="">Select tenant</option>
                  <option v-for="item in tenantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </UFormField>
              <UFormField label="Display Name">
                <UInput v-model="formDisplayName" class="w-full" :ui="inputUi" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <UFormField label="Provider Code">
                <UInput v-model="formProviderCode" class="w-full" :ui="inputUi" />
              </UFormField>
              <UFormField label="Status">
                <select v-model="formStatus" :class="nativeSelectClass">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </UFormField>
              <UFormField label="Base URL">
                <UInput v-model="formBaseUrl" class="w-full" :ui="inputUi" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <UFormField label="App Key">
                <UInput v-model="formAppKey" class="w-full" :ui="inputUi" />
              </UFormField>
              <UFormField label="App Secret">
                <UInput v-model="formAppSecret" class="w-full" :ui="inputUi" />
              </UFormField>
              <UFormField label="Webhook Secret">
                <UInput v-model="formWebhookSecret" class="w-full" :ui="inputUi" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-[220px_1fr]">
              <UFormField label="Preset Template">
                <select v-model="formPreset" :class="nativeSelectClass">
                  <option value="CUSTOM">Custom</option>
                  <option value="SLIP2GO">Slip2Go</option>
                  <option value="EASYSLIP">EasySlip</option>
                  <option value="OMISE">Omise</option>
                </select>
              </UFormField>
              <div class="flex items-end">
                <UButton color="neutral" variant="soft" icon="i-lucide-wand-sparkles" @click="applySlipPreset">Apply Preset</UButton>
              </div>
            </div>
            <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
              <template #header><p class="text-sm font-semibold">Slip Verify Request</p></template>
              <div class="grid gap-3 sm:grid-cols-4">
                <UFormField label="Verify Path"><UInput v-model="formVerifyPath" :ui="inputUi" /></UFormField>
                <UFormField label="Method"><select v-model="formVerifyMethod" :class="nativeSelectClass"><option value="POST">POST</option><option value="GET">GET</option></select></UFormField>
                <UFormField label="API Key Header"><UInput v-model="formApiKeyHeader" :ui="inputUi" /></UFormField>
                <UFormField label="Auth Type"><select v-model="formAuthType" :class="nativeSelectClass"><option value="bearer">bearer</option><option value="basic">basic</option><option value="none">none</option></select></UFormField>
              </div>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <UFormField label="Extra Headers (JSON)"><UTextarea v-model="formRequestExtraHeadersJson" :rows="4" placeholder='{"x-provider":"slip2go"}' class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
                <UFormField label="Payload Template (JSON)"><UTextarea v-model="formRequestPayloadTemplateJson" :rows="4" placeholder='{"checkCondition":{"checkDuplicate":true,"checkAmount":{"type":"eq","amount":"{{amount}}"}}}' class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
              </div>
            </UCard>
            <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
              <template #header><p class="text-sm font-semibold">Slip Verify Response Parsing</p></template>
              <div class="grid gap-3 sm:grid-cols-4">
                <UFormField label="Status Path"><UInput v-model="formResponseStatusPath" :ui="inputUi" /></UFormField>
                <UFormField label="Success Values (CSV)"><UInput v-model="formResponseSuccessValues" :ui="inputUi" /></UFormField>
                <UFormField label="Amount Path"><UInput v-model="formResponseAmountPath" :ui="inputUi" /></UFormField>
                <UFormField label="Reference Path"><UInput v-model="formResponseReferencePath" :ui="inputUi" /></UFormField>
              </div>
            </UCard>
            <UFormField label="Advanced Credentials JSON">
              <UTextarea v-model="formCredentialsJson" :rows="6" class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreate">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="saving" @click="submitForm('create')">Create</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="editOpen" :ui="modalUi">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Edit Slip Verify Connection</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeEdit" />
            </div>
          </template>
          <div class="space-y-4">
            <UAlert v-if="formError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="formError" />
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Tenant">
                <select v-model="formTenantId" :class="nativeSelectClass">
                  <option value="">Select tenant</option>
                  <option v-for="item in tenantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </UFormField>
              <UFormField label="Display Name">
                <UInput v-model="formDisplayName" class="w-full" :ui="inputUi" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <UFormField label="Provider Code">
                <UInput v-model="formProviderCode" class="w-full" :ui="inputUi" />
              </UFormField>
              <UFormField label="Status">
                <select v-model="formStatus" :class="nativeSelectClass">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </UFormField>
              <UFormField label="Base URL">
                <UInput v-model="formBaseUrl" class="w-full" :ui="inputUi" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <UFormField label="App Key">
                <UInput v-model="formAppKey" class="w-full" :ui="inputUi" />
              </UFormField>
              <UFormField label="App Secret">
                <UInput v-model="formAppSecret" class="w-full" :ui="inputUi" />
              </UFormField>
              <UFormField label="Webhook Secret">
                <UInput v-model="formWebhookSecret" class="w-full" :ui="inputUi" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-[220px_1fr]">
              <UFormField label="Preset Template">
                <select v-model="formPreset" :class="nativeSelectClass">
                  <option value="CUSTOM">Custom</option>
                  <option value="SLIP2GO">Slip2Go</option>
                  <option value="EASYSLIP">EasySlip</option>
                  <option value="OMISE">Omise</option>
                </select>
              </UFormField>
              <div class="flex items-end">
                <UButton color="neutral" variant="soft" icon="i-lucide-wand-sparkles" @click="applySlipPreset">Apply Preset</UButton>
              </div>
            </div>
            <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
              <template #header><p class="text-sm font-semibold">Slip Verify Request</p></template>
              <div class="grid gap-3 sm:grid-cols-4">
                <UFormField label="Verify Path"><UInput v-model="formVerifyPath" :ui="inputUi" /></UFormField>
                <UFormField label="Method"><select v-model="formVerifyMethod" :class="nativeSelectClass"><option value="POST">POST</option><option value="GET">GET</option></select></UFormField>
                <UFormField label="API Key Header"><UInput v-model="formApiKeyHeader" :ui="inputUi" /></UFormField>
                <UFormField label="Auth Type"><select v-model="formAuthType" :class="nativeSelectClass"><option value="bearer">bearer</option><option value="basic">basic</option><option value="none">none</option></select></UFormField>
              </div>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <UFormField label="Extra Headers (JSON)"><UTextarea v-model="formRequestExtraHeadersJson" :rows="4" placeholder='{"x-provider":"slip2go"}' class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
                <UFormField label="Payload Template (JSON)"><UTextarea v-model="formRequestPayloadTemplateJson" :rows="4" placeholder='{"checkCondition":{"checkDuplicate":true,"checkAmount":{"type":"eq","amount":"{{amount}}"}}}' class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
              </div>
            </UCard>
            <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
              <template #header><p class="text-sm font-semibold">Slip Verify Response Parsing</p></template>
              <div class="grid gap-3 sm:grid-cols-4">
                <UFormField label="Status Path"><UInput v-model="formResponseStatusPath" :ui="inputUi" /></UFormField>
                <UFormField label="Success Values (CSV)"><UInput v-model="formResponseSuccessValues" :ui="inputUi" /></UFormField>
                <UFormField label="Amount Path"><UInput v-model="formResponseAmountPath" :ui="inputUi" /></UFormField>
                <UFormField label="Reference Path"><UInput v-model="formResponseReferencePath" :ui="inputUi" /></UFormField>
              </div>
            </UCard>
            <UFormField label="Advanced Credentials JSON">
              <UTextarea v-model="formCredentialsJson" :rows="6" class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeEdit">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="saving" @click="submitForm('edit')">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Delete Connection</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="deleteOpen = false" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="deleteError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="deleteError" />
            <p class="text-sm text-slate-600 dark:text-slate-300">Type <span class="font-semibold text-rose-500">DELETE</span> and confirm connection name: <span class="font-semibold">{{ deleteName }}</span></p>
            <UInput v-model="deleteConfirmText" placeholder="Type DELETE" :ui="inputUi" />
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="deleteOpen = false">Cancel</UButton>
              <UButton color="error" :loading="deleteSaving" @click="confirmDelete">Delete</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
