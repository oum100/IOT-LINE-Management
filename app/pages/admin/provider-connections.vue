<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({
  middleware: 'platform-admin-auth'
})

type Tenant = { id: string; name: string; code: string }
type ProviderService = {
  id: string
  tenantId: string | null
  code: string
  displayName: string
  serviceType: 'PAYMENT_GATEWAY' | 'SLIP_VERIFY' | 'BANK_API'
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED'
  supportsQrGeneration: boolean
  supportsConfirmCallback: boolean
  supportsSingleTxnVerify: boolean
  supportsSingleSlipVerify: boolean
  metadata?: Record<string, unknown> | null
}
type ConnectionItem = {
  id: string
  tenantId: string
  code: string
  displayName: string
  providerServiceId: string | null
  providerCode: string
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED'
  baseUrl: string | null
  appKey: string | null
  appSecret: string | null
  webhookSecret: string | null
  supportsQrIssue: boolean
  supportsCallback: boolean
  supportsSlipVerify: boolean
  credentials: Record<string, unknown> | null
  linkedCount: number
  canDelete: boolean
  tenant: Tenant | null
  providerService: { id: string; code: string; displayName: string; serviceType: 'PAYMENT_GATEWAY' | 'SLIP_VERIFY' | 'BANK_API' } | null
}
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }

const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const search = ref('')

const filters = ref({ tenantId: '' })
const tenants = ref<Tenant[]>([])
const items = ref<ConnectionItem[]>([])

const createOpen = ref(false)
const editOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const formId = ref('')
const formTenantId = ref('')
const formDisplayName = ref('')
const formProviderServiceId = ref('')
const formProviderCode = ref<string>('MAEMANEE')
const formStatus = ref<'ACTIVE' | 'INACTIVE' | 'DISABLED'>('ACTIVE')
const formBaseUrl = ref('')
const formAppKey = ref('')
const formAppSecret = ref('')
const formWebhookSecret = ref('')
const formSupportsQrIssue = ref(true)
const formSupportsCallback = ref(true)
const formSupportsSlipVerify = ref(false)
const formCredentialsJson = ref('')
const formProviderServices = ref<ProviderService[]>([])
const formPreset = ref<'CUSTOM' | 'MAEMANEE' | 'KSHOP' | 'PROMPTPAY_GW' | 'SLIP2GO'>('CUSTOM')
const formIssuePath = ref('/qr/issue')
const formIssueMethod = ref<'POST' | 'GET'>('POST')
const formApiKeyHeader = ref('x-api-key')
const formAuthType = ref<'none' | 'bearer' | 'basic'>('bearer')
const formRequestExtraHeadersJson = ref('')
const formRequestPayloadTemplateJson = ref('')
const formResponseQrPayloadPath = ref('data.qrPayload')
const formResponsePaymentIntentPath = ref('data.providerPaymentIntentId')
const formResponseReferencePath = ref('data.providerReference')
const formCallbackProviderPaymentIntentPath = ref('data.txn_id')
const formCallbackProviderReferencePath = ref('data.reference')
const formCallbackOrderNumberPath = ref('data.orderNumber')
const formCallbackStatusPath = ref('data.status')
const formCallbackSuccessValues = ref('PAID,SUCCESS,VERIFIED,00')
const formCallbackFailedValues = ref('FAILED,REJECTED,CANCELLED,99')
const formCallbackAmountPath = ref('data.amount')
const formCallbackRejectNotePath = ref('data.reason')
const formAckStatusCode = ref(200)
const formAckBodyJson = ref('{"success":true}')

const deleteOpen = ref(false)
const deleteSaving = ref(false)
const deleteError = ref('')
const deleteId = ref('')
const deleteName = ref('')
const deleteConfirmText = ref('')
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const tenantOptions = computed(() => tenants.value.map(item => ({ label: item.name, value: item.id })))
const providerServiceOptions = computed(() => [
  { label: 'Select provider service', value: '' },
  ...formProviderServices.value.map(item => ({ label: `${item.displayName} (${item.serviceType})`, value: item.id }))
])
const selectedProviderService = computed(() => formProviderServices.value.find(item => item.id === formProviderServiceId.value) || null)
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
function applyProviderPreset() {
  if (formPreset.value === 'MAEMANEE') {
    formIssuePath.value = '/v1/qr/issue'
    formIssueMethod.value = 'POST'
    formApiKeyHeader.value = 'x-api-key'
    formAuthType.value = 'bearer'
    formRequestExtraHeadersJson.value = JSON.stringify({
      'x-provider': 'maemanee',
      'x-tenant': '{{tenantId}}'
    }, null, 2)
    formRequestPayloadTemplateJson.value = JSON.stringify({
      orderNo: '{{orderNumber}}',
      amount: '{{amount}}',
      callbackUrl: '{{callbackUrl}}',
      customerName: '{{customerName}}'
    }, null, 2)
    formResponseQrPayloadPath.value = 'data.qrPayload'
    formResponsePaymentIntentPath.value = 'data.paymentIntentId'
    formResponseReferencePath.value = 'data.reference'
    formCallbackProviderPaymentIntentPath.value = 'data.paymentIntentId'
    formCallbackProviderReferencePath.value = 'data.reference'
    formCallbackOrderNumberPath.value = 'data.orderNo'
    formCallbackStatusPath.value = 'data.status'
    formCallbackSuccessValues.value = 'PAID,SUCCESS,VERIFIED,00'
    formCallbackFailedValues.value = 'FAILED,REJECTED,CANCELLED,99'
    formCallbackAmountPath.value = 'data.amount'
    formCallbackRejectNotePath.value = 'data.message'
    formAckStatusCode.value = 200
    formAckBodyJson.value = '{"success":true,"message":"ok"}'
    return
  }
  if (formPreset.value === 'KSHOP') {
    formIssuePath.value = '/api/payment/qr/create'
    formIssueMethod.value = 'POST'
    formApiKeyHeader.value = 'x-client-id'
    formAuthType.value = 'basic'
    formRequestExtraHeadersJson.value = JSON.stringify({
      'x-request-source': 'platform'
    }, null, 2)
    formRequestPayloadTemplateJson.value = JSON.stringify({
      referenceNo: '{{orderNumber}}',
      amount: '{{amount}}',
      callback: '{{callbackUrl}}'
    }, null, 2)
    formResponseQrPayloadPath.value = 'result.qr'
    formResponsePaymentIntentPath.value = 'result.txnId'
    formResponseReferencePath.value = 'result.ref'
    formCallbackProviderPaymentIntentPath.value = 'result.txnId'
    formCallbackProviderReferencePath.value = 'result.ref'
    formCallbackOrderNumberPath.value = 'result.referenceNo'
    formCallbackStatusPath.value = 'result.paymentStatus'
    formCallbackSuccessValues.value = 'PAID,SUCCESS,COMPLETED'
    formCallbackFailedValues.value = 'FAILED,CANCELLED,EXPIRED'
    formCallbackAmountPath.value = 'result.amount'
    formCallbackRejectNotePath.value = 'result.rejectReason'
    formAckStatusCode.value = 200
    formAckBodyJson.value = '{"code":"00","message":"success"}'
    return
  }
  if (formPreset.value === 'PROMPTPAY_GW') {
    formIssuePath.value = '/qr/issue'
    formIssueMethod.value = 'POST'
    formApiKeyHeader.value = 'x-api-key'
    formAuthType.value = 'bearer'
    formRequestExtraHeadersJson.value = JSON.stringify({
      'x-channel': 'promptpay'
    }, null, 2)
    formRequestPayloadTemplateJson.value = JSON.stringify({
      orderNumber: '{{orderNumber}}',
      amount: '{{amount}}',
      callbackUrl: '{{callbackUrl}}'
    }, null, 2)
    formResponseQrPayloadPath.value = 'data.qrPayload'
    formResponsePaymentIntentPath.value = 'data.providerPaymentIntentId'
    formResponseReferencePath.value = 'data.providerReference'
    formCallbackProviderPaymentIntentPath.value = 'data.providerPaymentIntentId'
    formCallbackProviderReferencePath.value = 'data.providerReference'
    formCallbackOrderNumberPath.value = 'data.orderNumber'
    formCallbackStatusPath.value = 'data.status'
    formCallbackSuccessValues.value = 'PAID,SUCCESS,VERIFIED'
    formCallbackFailedValues.value = 'FAILED,REJECTED,CANCELLED'
    formCallbackAmountPath.value = 'data.amount'
    formCallbackRejectNotePath.value = 'data.reason'
    formAckStatusCode.value = 200
    formAckBodyJson.value = '{"success":true}'
    return
  }
  if (formPreset.value === 'SLIP2GO') {
    formIssuePath.value = '/v1/payments/qr/issue'
    formIssueMethod.value = 'POST'
    formApiKeyHeader.value = 'x-api-key'
    formAuthType.value = 'bearer'
    formRequestExtraHeadersJson.value = JSON.stringify({
      'x-provider': 'slip2go',
      'x-client': 'merchant-platform'
    }, null, 2)
    formRequestPayloadTemplateJson.value = JSON.stringify({
      orderNo: '{{orderNumber}}',
      amount: '{{amount}}',
      callbackUrl: '{{callbackUrl}}'
    }, null, 2)
    formResponseQrPayloadPath.value = 'data.qrPayload'
    formResponsePaymentIntentPath.value = 'data.txnId'
    formResponseReferencePath.value = 'data.reference'
    formCallbackProviderPaymentIntentPath.value = 'data.txnId'
    formCallbackProviderReferencePath.value = 'data.reference'
    formCallbackOrderNumberPath.value = 'data.orderNo'
    formCallbackStatusPath.value = 'data.status'
    formCallbackSuccessValues.value = 'SUCCESS,PAID,VERIFIED,00'
    formCallbackFailedValues.value = 'FAILED,REJECTED,CANCELLED,99'
    formCallbackAmountPath.value = 'data.amount'
    formCallbackRejectNotePath.value = 'data.reason'
    formAckStatusCode.value = 200
    formAckBodyJson.value = '{"success":true,"code":"200000"}'
    return
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
  const response = await $fetch<PagingResponse<Tenant>>('/api/admin/tenants', { query: { page: 1, pageSize: 200 } })
  tenants.value = response.items || []
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<PagingResponse<ConnectionItem>>('/api/admin/provider-connections', {
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
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Failed to load provider connections'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formId.value = ''
  formTenantId.value = ''
  formDisplayName.value = ''
  formProviderServiceId.value = ''
  formProviderCode.value = 'MAEMANEE'
  formStatus.value = 'ACTIVE'
  formBaseUrl.value = ''
  formAppKey.value = ''
  formAppSecret.value = ''
  formWebhookSecret.value = ''
  formSupportsQrIssue.value = true
  formSupportsCallback.value = true
  formSupportsSlipVerify.value = false
  formCredentialsJson.value = ''
  formIssuePath.value = '/qr/issue'
  formIssueMethod.value = 'POST'
  formApiKeyHeader.value = 'x-api-key'
  formAuthType.value = 'bearer'
  formRequestExtraHeadersJson.value = ''
  formRequestPayloadTemplateJson.value = ''
  formResponseQrPayloadPath.value = 'data.qrPayload'
  formResponsePaymentIntentPath.value = 'data.providerPaymentIntentId'
  formResponseReferencePath.value = 'data.providerReference'
  formCallbackProviderPaymentIntentPath.value = 'data.txn_id'
  formCallbackProviderReferencePath.value = 'data.reference'
  formCallbackOrderNumberPath.value = 'data.orderNumber'
  formCallbackStatusPath.value = 'data.status'
  formCallbackSuccessValues.value = 'PAID,SUCCESS,VERIFIED,00'
  formCallbackFailedValues.value = 'FAILED,REJECTED,CANCELLED,99'
  formCallbackAmountPath.value = 'data.amount'
  formCallbackRejectNotePath.value = 'data.reason'
  formAckStatusCode.value = 200
  formAckBodyJson.value = '{"success":true}'
  formProviderServices.value = []
  formError.value = ''
}

function openCreate() {
  resetForm()
  void loadProviderServicesForForm()
  createOpen.value = true
}

function openEdit(item: ConnectionItem) {
  resetForm()
  formId.value = item.id
  formTenantId.value = item.tenantId
  formDisplayName.value = item.displayName
  formProviderServiceId.value = item.providerServiceId || ''
  formProviderCode.value = item.providerCode
  formStatus.value = item.status
  formBaseUrl.value = item.baseUrl || ''
  formAppKey.value = item.appKey || ''
  formAppSecret.value = item.appSecret || ''
  formWebhookSecret.value = item.webhookSecret || ''
  formSupportsQrIssue.value = item.supportsQrIssue
  formSupportsCallback.value = item.supportsCallback
  formSupportsSlipVerify.value = item.supportsSlipVerify
  formCredentialsJson.value = item.credentials ? JSON.stringify(item.credentials, null, 2) : ''
  const cfg = item.credentials && typeof item.credentials === 'object' ? item.credentials as Record<string, any> : {}
  const req = cfg.requestConfig && typeof cfg.requestConfig === 'object' ? cfg.requestConfig : {}
  const res = cfg.responseConfig && typeof cfg.responseConfig === 'object' ? cfg.responseConfig : {}
  const cb = cfg.callbackConfig && typeof cfg.callbackConfig === 'object' ? cfg.callbackConfig : {}
  const lookup = cb.lookup && typeof cb.lookup === 'object' ? cb.lookup : {}
  const statusCfg = cb.status && typeof cb.status === 'object' ? cb.status : {}
  const ack = cfg.ackConfig && typeof cfg.ackConfig === 'object' ? cfg.ackConfig : {}
  formIssuePath.value = req.issuePath || cfg.issuePath || '/qr/issue'
  formIssueMethod.value = req.method === 'GET' ? 'GET' : 'POST'
  formApiKeyHeader.value = req.apiKeyHeader || cfg.apiKeyHeader || 'x-api-key'
  formAuthType.value = req.authType === 'basic' ? 'basic' : req.authType === 'none' ? 'none' : ((cfg.auth?.type === 'basic' ? 'basic' : cfg.auth?.type === 'none' ? 'none' : 'bearer') as any)
  formRequestExtraHeadersJson.value = req.extraHeaders ? JSON.stringify(req.extraHeaders, null, 2) : (cfg.extraHeaders ? JSON.stringify(cfg.extraHeaders, null, 2) : '')
  formRequestPayloadTemplateJson.value = req.payloadTemplate ? JSON.stringify(req.payloadTemplate, null, 2) : (cfg.issuePayloadTemplate ? JSON.stringify(cfg.issuePayloadTemplate, null, 2) : '')
  formResponseQrPayloadPath.value = res.qrPayloadPath || 'data.qrPayload'
  formResponsePaymentIntentPath.value = res.providerPaymentIntentIdPath || 'data.providerPaymentIntentId'
  formResponseReferencePath.value = res.providerReferencePath || 'data.providerReference'
  formCallbackProviderPaymentIntentPath.value = lookup.providerPaymentIntentIdPath || 'data.txn_id'
  formCallbackProviderReferencePath.value = lookup.providerReferencePath || 'data.reference'
  formCallbackOrderNumberPath.value = lookup.orderNumberPath || 'data.orderNumber'
  formCallbackStatusPath.value = statusCfg.path || 'data.status'
  formCallbackSuccessValues.value = Array.isArray(statusCfg.successValues) ? statusCfg.successValues.join(',') : 'PAID,SUCCESS,VERIFIED,00'
  formCallbackFailedValues.value = Array.isArray(statusCfg.failedValues) ? statusCfg.failedValues.join(',') : 'FAILED,REJECTED,CANCELLED,99'
  formCallbackAmountPath.value = cb.amountPath || 'data.amount'
  formCallbackRejectNotePath.value = cb.rejectNotePath || 'data.reason'
  formAckStatusCode.value = Number(ack.statusCode || 200)
  formAckBodyJson.value = ack.body ? JSON.stringify(ack.body, null, 2) : '{"success":true}'
  void loadProviderServicesForForm()
  editOpen.value = true
}

async function loadProviderServicesForForm() {
  const query: Record<string, unknown> = { page: 1, pageSize: 200, status: 'ACTIVE' }
  const response = await $fetch<PagingResponse<ProviderService>>('/api/admin/provider-services', { query })
  formProviderServices.value = (response.items || []).filter(item => !item.tenantId || item.tenantId === formTenantId.value)
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
  if (!formProviderServiceId.value) {
    formError.value = 'Provider service is required'
    return
  }
  const credentialsPayload = (selectedProviderService.value?.metadata && typeof selectedProviderService.value.metadata === 'object')
    ? selectedProviderService.value.metadata as Record<string, unknown>
    : null
  saving.value = true
  formError.value = ''
  try {
    const payload = {
      tenantId: formTenantId.value,
      displayName: formDisplayName.value.trim(),
      providerCode: (selectedProviderService.value?.code || formProviderCode.value) as any,
      providerServiceId: formProviderServiceId.value,
      status: formStatus.value,
      baseUrl: formBaseUrl.value.trim() || null,
      appKey: formAppKey.value.trim() || null,
      appSecret: formAppSecret.value.trim() || null,
      webhookSecret: formWebhookSecret.value.trim() || null,
      supportsQrIssue: formSupportsQrIssue.value,
      supportsCallback: formSupportsCallback.value,
      supportsSlipVerify: formSupportsSlipVerify.value,
      credentials: credentialsPayload
    }
    if (mode === 'create') {
      await $fetch('/api/admin/provider-connections', { method: 'POST', body: payload })
      closeCreate()
    } else {
      await $fetch(`/api/admin/provider-connections/${formId.value}`, { method: 'PATCH', body: payload })
      closeEdit()
    }
    await loadData()
  } catch (err) {
    formError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Failed to save provider connection'
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
    await $fetch(`/api/admin/provider-connections/${deleteId.value}`, {
      method: 'DELETE',
      body: {
        confirmText: 'DELETE',
        confirmName: deleteName.value
      }
    })
    deleteOpen.value = false
    await loadData()
  } catch (err) {
    deleteError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Failed to delete provider connection'
  } finally {
    deleteSaving.value = false
  }
}

watch(() => filters.value.tenantId, async () => {
  page.value = 1
  await loadData()
})

watch(formProviderServiceId, () => {
  if (!selectedProviderService.value) return
  formProviderCode.value = selectedProviderService.value.code
  formSupportsQrIssue.value = Boolean(selectedProviderService.value.supportsQrGeneration)
  formSupportsCallback.value = Boolean(selectedProviderService.value.supportsConfirmCallback)
  formSupportsSlipVerify.value = Boolean(selectedProviderService.value.supportsSingleSlipVerify || selectedProviderService.value.supportsSingleTxnVerify)
})

watch(formTenantId, async () => {
  await loadProviderServicesForForm()
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
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Provider Connections</p>
          <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Provider Connections</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Manage tenant payment provider credentials and callback capabilities.</p>
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

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Provider Connection List</h2>
            <p class="text-sm text-slate-500 dark:text-slate-300">{{ total }} items</p>
          </div>
          <UButton icon="i-lucide-plus" color="success" @click="openCreate">Create Provider Connection</UButton>
        </div>
      </template>

      <UAlert v-if="error" color="error" variant="soft" :title="error" class="mb-4" />

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-200/90 text-slate-700 dark:bg-slate-800/95 dark:text-slate-200">
            <tr>
              <th class="px-3 py-2 text-left font-semibold">Code</th>
              <th class="px-3 py-2 text-left font-semibold">Display Name</th>
              <th class="px-3 py-2 text-left font-semibold">Tenant</th>
              <th class="px-3 py-2 text-left font-semibold">Provider</th>
              <th class="px-3 py-2 text-left font-semibold">Base URL</th>
              <th class="px-3 py-2 text-left font-semibold">App Key</th>
              <th class="px-3 py-2 text-left font-semibold">App Secret</th>
              <th class="px-3 py-2 text-left font-semibold">Webhook Secret</th>
              <th class="px-3 py-2 text-left font-semibold">Features</th>
              <th class="px-3 py-2 text-left font-semibold">Status</th>
              <th class="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="11" class="px-3 py-4 text-center text-slate-500 dark:text-slate-300">Loading connections...</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="11" class="px-3 py-4 text-center text-slate-500 dark:text-slate-300">No provider connections found.</td>
            </tr>
            <tr v-for="item in items" :key="item.id" class="border-t border-slate-200 dark:border-slate-800">
              <td class="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{{ item.code }}</td>
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-white">{{ item.displayName }}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ item.tenant?.name || item.tenantId }}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ item.providerCode }}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ item.baseUrl || '-' }}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ item.appKey || '-' }}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ maskedSecret(item.appSecret) }}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ maskedSecret(item.webhookSecret) }}</td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-2">
                  <span v-if="item.supportsQrIssue" class="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">QR Generation</span>
                  <span v-if="item.supportsCallback" class="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Payment Confirm</span>
                  <span v-if="item.supportsSlipVerify" class="rounded-md bg-fuchsia-100 px-2 py-0.5 text-xs font-semibold text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300">Slip Verification</span>
                  <span
                    v-if="!item.supportsQrIssue && !item.supportsCallback && !item.supportsSlipVerify"
                    class="text-xs text-slate-500 dark:text-slate-400"
                  >
                    -
                  </span>
                </div>
              </td>
              <td class="px-3 py-2 font-semibold" :class="statusClass(item.status)">{{ item.status }}</td>
              <td class="px-3 py-2">
                <div class="flex justify-end gap-2">
                  <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click="openEdit(item)" />
                  <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :disabled="!item.canDelete" @click="loadDelete(item)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-slate-500 dark:text-slate-300">Page {{ page }} / {{ totalPages }} ({{ total }} total)</p>
          <div class="flex items-center gap-2">
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-chevron-left" :disabled="page <= 1" @click="page -= 1; loadData()" />
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-chevron-right" :disabled="page >= totalPages" @click="page += 1; loadData()" />
          </div>
        </div>
      </template>
    </UCard>

    <UModal v-model:open="createOpen" title="Create Provider Connection" :ui="modalUi">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="formError" color="error" variant="soft" :title="formError" />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Tenant">
              <select v-model="formTenantId" :class="nativeSelectClass">
                <option value="">Select tenant</option>
                <option v-for="item in tenantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Display Name">
              <UInput v-model="formDisplayName" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Provider Service">
              <select v-model="formProviderServiceId" :class="nativeSelectClass">
                <option v-for="item in providerServiceOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Status">
              <select v-model="formStatus" :class="nativeSelectClass">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="App Key">
              <UInput v-model="formAppKey" :ui="inputUi" class="w-full" />
            </UFormField>
            <UFormField label="App Secret">
              <UInput v-model="formAppSecret" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>
          <div class="grid gap-4">
            <UFormField label="Base URL">
              <UInput v-model="formBaseUrl" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="closeCreate">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="submitForm('create')">Create</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="editOpen" title="Edit Provider Connection" :ui="modalUi">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="formError" color="error" variant="soft" :title="formError" />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Tenant">
              <select v-model="formTenantId" :class="nativeSelectClass">
                <option value="">Select tenant</option>
                <option v-for="item in tenantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Display Name">
              <UInput v-model="formDisplayName" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Provider Service">
              <select v-model="formProviderServiceId" :class="nativeSelectClass">
                <option v-for="item in providerServiceOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Status">
              <select v-model="formStatus" :class="nativeSelectClass">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="App Key">
              <UInput v-model="formAppKey" :ui="inputUi" class="w-full" />
            </UFormField>
            <UFormField label="App Secret">
              <UInput v-model="formAppSecret" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>
          <div class="grid gap-4">
            <UFormField label="Base URL">
              <UInput v-model="formBaseUrl" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="closeEdit">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="submitForm('edit')">Save</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Delete Provider Connection" :ui="modalUi">
      <template #body>
        <div class="space-y-4">
          <UAlert color="error" variant="soft" :title="`Delete ${deleteName}`" description="Type DELETE to confirm." />
          <UAlert v-if="deleteError" color="error" variant="soft" :title="deleteError" />
          <UFormField label="Confirm">
            <UInput v-model="deleteConfirmText" :ui="inputUi" placeholder="DELETE" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="deleteOpen = false">Cancel</UButton>
          <UButton color="error" :loading="deleteSaving" @click="confirmDelete">Delete</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
