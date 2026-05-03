<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({ middleware: 'platform-admin-auth' })

type Tenant = { id: string; name: string; code: string }
type Item = {
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
  isDefault: boolean
  metadata: Record<string, any> | null
  tenant: Tenant | null
  linkedCount: number
  canDelete: boolean
}
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }
type ProviderTemplate = {
  key: string
  label: string
  serviceType: 'PAYMENT_GATEWAY' | 'SLIP_VERIFY' | 'BANK_API'
  feature: {
    qr: boolean
    callback: boolean
    txnVerify: boolean
    slipVerify: boolean
  }
  mapping: {
    issuePath: string
    issueMethod: 'POST' | 'GET'
    apiKeyHeader: string
    authType: 'none' | 'bearer' | 'basic'
    responseQrPayloadPath: string
    responsePaymentIntentPath: string
    responseReferencePath: string
    webhookSecretHeader: string
    callbackProviderPaymentIntentPath: string
    callbackProviderReferencePath: string
    callbackOrderNumberPath: string
    callbackStatusPath: string
    callbackSuccessValues: string
    callbackFailedValues: string
    callbackAmountPath: string
    callbackRejectNotePath: string
    ackStatusCode: number
    ackBodyJson: string
    requestExtraHeadersJson?: string
    requestPayloadTemplateJson?: string
  }
}

const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const search = ref('')
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)
const filters = ref({ serviceType: '' })
const items = ref<Item[]>([])

const createOpen = ref(false)
const editOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const formId = ref('')
const formCode = ref('')
const formDisplayName = ref('')
const formServiceType = ref<'PAYMENT_GATEWAY' | 'SLIP_VERIFY' | 'BANK_API'>('PAYMENT_GATEWAY')
const formStatus = ref<'ACTIVE' | 'INACTIVE' | 'DISABLED'>('ACTIVE')
const formSupportsQrGeneration = ref(true)
const formSupportsConfirmCallback = ref(true)
const formSupportsSingleTxnVerify = ref(true)
const formSupportsSingleSlipVerify = ref(false)
const formIsDefault = ref(false)
const formIssuePath = ref('/api/v1/payment-intents')
const formIssueMethod = ref<'POST' | 'GET'>('POST')
const formApiKeyHeader = ref('x-api-key')
const formAuthType = ref<'none' | 'bearer' | 'basic'>('none')
const formRequestExtraHeadersJson = ref('')
const formRequestPayloadTemplateJson = ref('')
const formResponseQrPayloadPath = ref('qrPayload')
const formResponsePaymentIntentPath = ref('publicId')
const formResponseReferencePath = ref('merchantReference')
const formWebhookSecretHeader = ref('x-signature')
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
const autoConfigNote = ref('')
const formTemplateCode = ref('')

const providerTemplates: ProviderTemplate[] = [
  {
    key: 'PAYIQ_PROMPTPAY',
    label: 'PayIQ',
    serviceType: 'PAYMENT_GATEWAY',
    feature: { qr: true, callback: true, txnVerify: true, slipVerify: false },
    mapping: {
      issuePath: '/api/v1/payment-intents',
      issueMethod: 'POST',
      apiKeyHeader: 'x-api-key',
      authType: 'none',
      responseQrPayloadPath: 'qrPayload',
      responsePaymentIntentPath: 'publicId',
      responseReferencePath: 'merchantReference',
      webhookSecretHeader: 'x-signature',
      callbackProviderPaymentIntentPath: 'data.txn_id',
      callbackProviderReferencePath: 'data.reference',
      callbackOrderNumberPath: 'data.orderNumber',
      callbackStatusPath: 'data.status',
      callbackSuccessValues: 'PAID,SUCCESS,VERIFIED,00',
      callbackFailedValues: 'FAILED,REJECTED,CANCELLED,99',
      callbackAmountPath: 'data.amount',
      callbackRejectNotePath: 'data.reason',
      ackStatusCode: 200,
      ackBodyJson: '{"success":true}',
      requestExtraHeadersJson: '{"Idempotency-Key":"{{idempotencyKey}}"}',
      requestPayloadTemplateJson: '{"amount":"{{amount}}","currency":"THB","paymentMethodType":"PROMPTPAY_QR","merchantOrderId":"{{orderNumber}}","merchantReference":"{{reference}}","callbackUrl":"{{callbackUrl}}"}'
    }
  },
  {
    key: 'KSHER_PROMPTPAY',
    label: 'Ksher',
    serviceType: 'PAYMENT_GATEWAY',
    feature: { qr: true, callback: true, txnVerify: true, slipVerify: false },
    mapping: {
      issuePath: '/v1/payments/qr',
      issueMethod: 'POST',
      apiKeyHeader: 'Authorization',
      authType: 'bearer',
      responseQrPayloadPath: 'data.qrPayload',
      responsePaymentIntentPath: 'data.paymentIntentId',
      responseReferencePath: 'data.reference',
      webhookSecretHeader: 'x-ksher-signature',
      callbackProviderPaymentIntentPath: 'data.paymentIntentId',
      callbackProviderReferencePath: 'data.reference',
      callbackOrderNumberPath: 'data.orderNo',
      callbackStatusPath: 'data.status',
      callbackSuccessValues: 'PAID,SUCCESS',
      callbackFailedValues: 'FAILED,CANCELLED',
      callbackAmountPath: 'data.amount',
      callbackRejectNotePath: 'data.message',
      ackStatusCode: 200,
      ackBodyJson: '{"code":"SUCCESS"}'
    }
  },
  {
    key: 'SLIP2GO_VERIFY',
    label: 'Slip2Go',
    serviceType: 'SLIP_VERIFY',
    feature: { qr: false, callback: false, txnVerify: false, slipVerify: true },
    mapping: {
      issuePath: '/api/verify-slip',
      issueMethod: 'POST',
      apiKeyHeader: 'x-api-key',
      authType: 'none',
      responseQrPayloadPath: 'data.qrPayload',
      responsePaymentIntentPath: 'data.intentId',
      responseReferencePath: 'data.reference',
      webhookSecretHeader: 'x-signature',
      callbackProviderPaymentIntentPath: 'data.txnId',
      callbackProviderReferencePath: 'data.reference',
      callbackOrderNumberPath: 'data.orderNumber',
      callbackStatusPath: 'data.status',
      callbackSuccessValues: 'VERIFIED,SUCCESS',
      callbackFailedValues: 'FAILED,REJECTED',
      callbackAmountPath: 'data.amount',
      callbackRejectNotePath: 'data.reason',
      ackStatusCode: 200,
      ackBodyJson: '{"success":true}'
    }
  }
]

const deleteOpen = ref(false)
const deleteSaving = ref(false)
const deleteId = ref('')
const deleteConfirmText = ref('')
const deleteError = ref('')

const inputUi = {
  base: 'h-10 bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500'
}
const nativeSelectClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const serviceLabel: Record<string, string> = {
  PAYMENT_GATEWAY: 'Payment Gateway',
  SLIP_VERIFY: 'Slip Verify',
  BANK_API: 'Bank API'
}
const serviceShortLabel: Record<string, string> = {
  PAYMENT_GATEWAY: 'Payment GW',
  SLIP_VERIFY: 'Slip Verify',
  BANK_API: 'Bank API'
}

function buildProviderCode(displayName: string) {
  const prefix = (displayName || 'PROVIDER')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 12) || 'PROVIDER'
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, '0')
  return `${prefix}_${suffix}`
}
function resetForm() {
  formId.value = ''
  formCode.value = ''
  formDisplayName.value = ''
  formServiceType.value = 'PAYMENT_GATEWAY'
  formCode.value = ''
  formStatus.value = 'ACTIVE'
  formSupportsQrGeneration.value = true
  formSupportsConfirmCallback.value = true
  formSupportsSingleTxnVerify.value = true
  formSupportsSingleSlipVerify.value = false
  formIsDefault.value = false
  formIssuePath.value = '/api/v1/payment-intents'
  formIssueMethod.value = 'POST'
  formApiKeyHeader.value = 'x-api-key'
  formAuthType.value = 'none'
  formRequestExtraHeadersJson.value = ''
  formRequestPayloadTemplateJson.value = ''
  formResponseQrPayloadPath.value = 'qrPayload'
  formResponsePaymentIntentPath.value = 'publicId'
  formResponseReferencePath.value = 'merchantReference'
  formWebhookSecretHeader.value = 'x-signature'
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
  autoConfigNote.value = ''
  formTemplateCode.value = ''
  formError.value = ''
}

function applyDefaultFeatures(type: 'PAYMENT_GATEWAY' | 'SLIP_VERIFY' | 'BANK_API') {
  if (type === 'PAYMENT_GATEWAY') {
    formSupportsQrGeneration.value = true
    formSupportsConfirmCallback.value = true
    formSupportsSingleTxnVerify.value = true
    formSupportsSingleSlipVerify.value = false
    return
  }
  if (type === 'SLIP_VERIFY') {
    formSupportsQrGeneration.value = false
    formSupportsConfirmCallback.value = false
    formSupportsSingleTxnVerify.value = false
    formSupportsSingleSlipVerify.value = true
    return
  }
  formSupportsQrGeneration.value = false
  formSupportsConfirmCallback.value = false
  formSupportsSingleTxnVerify.value = false
  formSupportsSingleSlipVerify.value = false
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<PagingResponse<Item>>('/api/admin/provider-services', {
      query: {
        ...(filters.value.serviceType ? { serviceType: filters.value.serviceType } : {}),
        ...(search.value.trim() ? { q: search.value.trim() } : {}),
        page: page.value,
        pageSize: pageSize.value
      }
    })
    items.value = res.items || []
    total.value = Number(res.total || 0)
  } catch (err) {
    items.value = []
    total.value = 0
    error.value = (err as any)?.data?.statusMessage || 'Failed to load provider services'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  createOpen.value = true
}

function openEdit(item: Item) {
  resetForm()
  formId.value = item.id
  formCode.value = item.code
  formDisplayName.value = item.displayName
  formServiceType.value = item.serviceType
  formStatus.value = item.status
  formSupportsQrGeneration.value = item.supportsQrGeneration
  formSupportsConfirmCallback.value = item.supportsConfirmCallback
  formSupportsSingleTxnVerify.value = item.supportsSingleTxnVerify
  formSupportsSingleSlipVerify.value = item.supportsSingleSlipVerify
  formIsDefault.value = item.isDefault
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const req = (meta as any).requestConfig && typeof (meta as any).requestConfig === 'object' ? (meta as any).requestConfig : {}
  const res = (meta as any).responseConfig && typeof (meta as any).responseConfig === 'object' ? (meta as any).responseConfig : {}
  const cb = (meta as any).callbackConfig && typeof (meta as any).callbackConfig === 'object' ? (meta as any).callbackConfig : {}
  const lookup = cb.lookup && typeof cb.lookup === 'object' ? cb.lookup : {}
  const status = cb.status && typeof cb.status === 'object' ? cb.status : {}
  const ack = (meta as any).ackConfig && typeof (meta as any).ackConfig === 'object' ? (meta as any).ackConfig : {}
  formTemplateCode.value = typeof (meta as any).templateCode === 'string' ? (meta as any).templateCode : ''
  formIssuePath.value = req.issuePath || '/api/v1/payment-intents'
  formIssueMethod.value = req.method === 'GET' ? 'GET' : 'POST'
  formApiKeyHeader.value = req.apiKeyHeader || 'x-api-key'
  formAuthType.value = req.authType === 'basic' ? 'basic' : req.authType === 'bearer' ? 'bearer' : 'none'
  formRequestExtraHeadersJson.value = req.extraHeaders ? JSON.stringify(req.extraHeaders, null, 2) : ''
  formRequestPayloadTemplateJson.value = req.payloadTemplate ? JSON.stringify(req.payloadTemplate, null, 2) : ''
  formResponseQrPayloadPath.value = res.qrPayloadPath || 'qrPayload'
  formResponsePaymentIntentPath.value = res.providerPaymentIntentIdPath || 'publicId'
  formResponseReferencePath.value = res.providerReferencePath || 'merchantReference'
  formWebhookSecretHeader.value = cb.signatureHeader || 'x-signature'
  formCallbackProviderPaymentIntentPath.value = lookup.providerPaymentIntentIdPath || 'data.txn_id'
  formCallbackProviderReferencePath.value = lookup.providerReferencePath || 'data.reference'
  formCallbackOrderNumberPath.value = lookup.orderNumberPath || 'data.orderNumber'
  formCallbackStatusPath.value = status.path || 'data.status'
  formCallbackSuccessValues.value = Array.isArray(status.successValues) ? status.successValues.join(',') : 'PAID,SUCCESS,VERIFIED,00'
  formCallbackFailedValues.value = Array.isArray(status.failedValues) ? status.failedValues.join(',') : 'FAILED,REJECTED,CANCELLED,99'
  formCallbackAmountPath.value = cb.amountPath || 'data.amount'
  formCallbackRejectNotePath.value = cb.rejectNotePath || 'data.reason'
  formAckStatusCode.value = Number(ack.statusCode || 200)
  formAckBodyJson.value = ack.body ? JSON.stringify(ack.body, null, 2) : '{"success":true}'
  autoConfigNote.value = ''
  editOpen.value = true
}

function applyTemplateByCode() {
  const selected = providerTemplates.find(t => t.key === formTemplateCode.value)
  if (!selected) return
  const m = selected.mapping
  formServiceType.value = selected.serviceType
  formSupportsQrGeneration.value = selected.feature.qr
  formSupportsConfirmCallback.value = selected.feature.callback
  formSupportsSingleTxnVerify.value = selected.feature.txnVerify
  formSupportsSingleSlipVerify.value = selected.feature.slipVerify
  formIssuePath.value = m.issuePath
  formIssueMethod.value = m.issueMethod
  formApiKeyHeader.value = m.apiKeyHeader
  formAuthType.value = m.authType
  formResponseQrPayloadPath.value = m.responseQrPayloadPath
  formResponsePaymentIntentPath.value = m.responsePaymentIntentPath
  formResponseReferencePath.value = m.responseReferencePath
  formWebhookSecretHeader.value = m.webhookSecretHeader
  formCallbackProviderPaymentIntentPath.value = m.callbackProviderPaymentIntentPath
  formCallbackProviderReferencePath.value = m.callbackProviderReferencePath
  formCallbackOrderNumberPath.value = m.callbackOrderNumberPath
  formCallbackStatusPath.value = m.callbackStatusPath
  formCallbackSuccessValues.value = m.callbackSuccessValues
  formCallbackFailedValues.value = m.callbackFailedValues
  formCallbackAmountPath.value = m.callbackAmountPath
  formCallbackRejectNotePath.value = m.callbackRejectNotePath
  formAckStatusCode.value = m.ackStatusCode
  formAckBodyJson.value = m.ackBodyJson
  formRequestExtraHeadersJson.value = m.requestExtraHeadersJson || ''
  formRequestPayloadTemplateJson.value = m.requestPayloadTemplateJson || ''
  autoConfigNote.value = `Template applied: ${selected.label}`
}

async function submit(mode: 'create' | 'edit') {
  if (!formDisplayName.value.trim()) {
    formError.value = 'Display name is required'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    let headersJson: Record<string, unknown> = {}
    let payloadJson: Record<string, unknown> = {}
    let ackBody: Record<string, unknown> = { success: true }
    if (formRequestExtraHeadersJson.value.trim()) headersJson = JSON.parse(formRequestExtraHeadersJson.value)
    if (formRequestPayloadTemplateJson.value.trim()) payloadJson = JSON.parse(formRequestPayloadTemplateJson.value)
    if (formAckBodyJson.value.trim()) ackBody = JSON.parse(formAckBodyJson.value)
    const metadata = {
      templateCode: formTemplateCode.value || null,
      requestConfig: {
        issuePath: formIssuePath.value.trim() || '/api/v1/payment-intents',
        method: formIssueMethod.value,
        apiKeyHeader: formApiKeyHeader.value.trim() || 'x-api-key',
        authType: formAuthType.value,
        extraHeaders: headersJson,
        payloadTemplate: payloadJson
      },
      responseConfig: {
        qrPayloadPath: formResponseQrPayloadPath.value.trim() || 'qrPayload',
        providerPaymentIntentIdPath: formResponsePaymentIntentPath.value.trim() || 'publicId',
        providerReferencePath: formResponseReferencePath.value.trim() || 'merchantReference'
      },
      callbackConfig: {
        signatureHeader: formWebhookSecretHeader.value.trim() || 'x-signature',
        lookup: {
          providerPaymentIntentIdPath: formCallbackProviderPaymentIntentPath.value.trim(),
          providerReferencePath: formCallbackProviderReferencePath.value.trim(),
          orderNumberPath: formCallbackOrderNumberPath.value.trim()
        },
        status: {
          path: formCallbackStatusPath.value.trim(),
          successValues: formCallbackSuccessValues.value.split(',').map(v => v.trim()).filter(Boolean),
          failedValues: formCallbackFailedValues.value.split(',').map(v => v.trim()).filter(Boolean)
        },
        amountPath: formCallbackAmountPath.value.trim(),
        rejectNotePath: formCallbackRejectNotePath.value.trim()
      },
      ackConfig: {
        statusCode: Number(formAckStatusCode.value) || 200,
        body: ackBody
      }
    }
    const selectedTemplate = providerTemplates.find(t => t.key === formTemplateCode.value)
    const payload = {
      tenantId: null,
      code: (mode === 'create' ? buildProviderCode(formDisplayName.value) : formCode.value.trim().toUpperCase()),
      displayName: formDisplayName.value.trim(),
      serviceType: selectedTemplate?.serviceType || formServiceType.value,
      status: formStatus.value,
      supportsQrGeneration: formSupportsQrGeneration.value,
      supportsConfirmCallback: formSupportsConfirmCallback.value,
      supportsSingleTxnVerify: formSupportsSingleTxnVerify.value,
      supportsSingleSlipVerify: formSupportsSingleSlipVerify.value,
      isDefault: formIsDefault.value,
      metadata
    }
    if (mode === 'create') {
      await $fetch('/api/admin/provider-services', { method: 'POST', body: payload })
      createOpen.value = false
    } else {
      await $fetch(`/api/admin/provider-services/${formId.value}`, { method: 'PATCH', body: payload })
      editOpen.value = false
    }
    await loadData()
  } catch (err) {
    if (err instanceof SyntaxError) {
      formError.value = 'Invalid JSON in headers, payload template, or ACK body.'
    } else {
      formError.value = (err as any)?.data?.statusMessage || 'Failed to save provider service'
    }
  } finally {
    saving.value = false
  }
}

function openDelete(item: Item) {
  deleteId.value = item.id
  deleteConfirmText.value = ''
  deleteError.value = ''
  deleteOpen.value = true
}

async function confirmDelete() {
  if (deleteConfirmText.value.trim() !== 'DELETE') {
    deleteError.value = 'Type DELETE to confirm'
    return
  }
  deleteSaving.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/admin/provider-services/${deleteId.value}`, { method: 'DELETE', body: { confirmText: 'DELETE' } })
    deleteOpen.value = false
    await loadData()
  } catch (err) {
    deleteError.value = (err as any)?.data?.statusMessage || 'Failed to delete provider service'
  } finally {
    deleteSaving.value = false
  }
}

watch(() => filters.value.serviceType, async () => { page.value = 1; await loadData() })
watch(search, (value) => {
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
  searchDebounce.value = setTimeout(() => { page.value = 1; void loadData() }, value.trim() ? 250 : 0)
})
watch(formServiceType, (v) => applyDefaultFeatures(v))

onMounted(async () => { await loadData() })
</script>

<template>
  <div class="space-y-4">
    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-[240px]">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Provider</p>
          <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Provider Service</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Catalog of provider options used by Provider Connection (no tenant binding here).</p>
        </div>
        <div class="grid min-w-[320px] gap-3 sm:grid-cols-2">
          <UFormField label="Type">
            <select v-model="filters.serviceType" :class="nativeSelectClass">
              <option value="">All types</option>
              <option value="PAYMENT_GATEWAY">Payment Gateway</option>
              <option value="SLIP_VERIFY">Slip Verify</option>
              <option value="BANK_API">Bank API</option>
            </select>
          </UFormField>
          <UFormField label="Search">
            <SearchInput v-model="search" placeholder="Search code/name..." />
          </UFormField>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Provider Service List</h2>
            <p class="text-sm text-slate-500 dark:text-slate-300">{{ total }} items</p>
            <p class="text-xs text-amber-600 dark:text-amber-300">Delete is disabled when provider service is linked to provider connections.</p>
          </div>
          <UButton color="success" icon="i-lucide-plus" @click="openCreate">Create Provider Service</UButton>
        </div>
      </template>
      <UAlert v-if="error" color="error" variant="soft" :title="error" class="mb-4" />
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-200/90 text-slate-700 dark:bg-slate-800/95 dark:text-slate-200">
            <tr>
              <th class="px-3 py-2 text-left">Code</th>
              <th class="px-3 py-2 text-left">Display Name</th>
              <th class="px-3 py-2 text-left">Type</th>
              <th class="px-3 py-2 text-left">Features</th>
              <th class="px-3 py-2 text-left">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="6" class="px-3 py-4 text-center text-slate-500 dark:text-slate-300">Loading...</td></tr>
            <tr v-else-if="!items.length"><td colspan="6" class="px-3 py-4 text-center text-slate-500 dark:text-slate-300">No items.</td></tr>
            <tr v-for="item in items" :key="item.id" class="border-t border-slate-200 dark:border-slate-800">
              <td class="px-3 py-2 font-mono text-xs">{{ item.code }}</td>
              <td class="px-3 py-2">{{ item.displayName }}</td>
              <td class="px-3 py-2">{{ serviceLabel[item.serviceType] || item.serviceType }}</td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-2">
                  <span v-if="item.supportsQrGeneration" class="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">QR Generation</span>
                  <span v-if="item.supportsConfirmCallback" class="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Payment Confirm</span>
                  <span v-if="item.supportsSingleTxnVerify" class="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Transaction Inquiry</span>
                  <span v-if="item.supportsSingleSlipVerify" class="rounded-md bg-fuchsia-100 px-2 py-0.5 text-xs font-semibold text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300">Slip Verification</span>
                  <span
                    v-if="!item.supportsQrGeneration && !item.supportsConfirmCallback && !item.supportsSingleTxnVerify && !item.supportsSingleSlipVerify"
                    class="text-xs text-slate-500 dark:text-slate-400"
                  >
                    -
                  </span>
                </div>
              </td>
              <td class="px-3 py-2 font-semibold" :class="item.status === 'ACTIVE' ? 'text-emerald-500' : item.status === 'INACTIVE' ? 'text-amber-500' : 'text-rose-500'">{{ item.status }}</td>
              <td class="px-3 py-2">
                <div class="flex flex-col items-end gap-1">
                  <div class="flex justify-end gap-2">
                    <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click="openEdit(item)" />
                    <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :disabled="!item.canDelete" :title="item.canDelete ? 'Delete' : 'Cannot delete: already linked'" @click="openDelete(item)" />
                  </div>
                  <span v-if="!item.canDelete" class="text-[11px] font-medium text-amber-600 dark:text-amber-300">In use - cannot delete</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500 dark:text-slate-300">Page {{ page }} / {{ totalPages }} ({{ total }} total)</p>
          <div class="flex gap-2">
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-chevron-left" :disabled="page <= 1" @click="page -= 1; loadData()" />
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-chevron-right" :disabled="page >= totalPages" @click="page += 1; loadData()" />
          </div>
        </div>
      </template>
    </UCard>

    <UModal v-model:open="createOpen" title="Create Provider Service" :ui="{ content: 'w-full sm:max-w-6xl bg-white dark:bg-slate-900' }">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="formError" color="error" variant="soft" :title="formError" />
          <UAlert v-if="autoConfigNote" color="success" variant="soft" :title="autoConfigNote" />
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Display Name"><UInput v-model="formDisplayName" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Code (Auto)"><UInput :model-value="formCode || 'Auto on create'" :ui="inputUi" class="w-full" readonly /></UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Provider (Type)">
                <select v-model="formTemplateCode" :class="nativeSelectClass" @change="applyTemplateByCode">
                  <option value="">Select provider template</option>
                  <option v-for="tpl in providerTemplates" :key="tpl.key" :value="tpl.key">
                    {{ tpl.label }} ({{ serviceShortLabel[tpl.serviceType] }})
                  </option>
                </select>
              </UFormField>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Status"><select v-model="formStatus" :class="nativeSelectClass"><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="DISABLED">DISABLED</option></select></UFormField>
                <label class="mt-6 flex h-10 items-center gap-2 rounded-md bg-amber-100 px-2 text-sm font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><input v-model="formIsDefault" type="checkbox" class="h-4 w-4">Set Default Service</label>
              </div>
            </div>
            <div class="space-y-3">
              <div class="grid gap-4 sm:grid-cols-4">
                <label class="flex h-10 items-center gap-2 text-sm dark:text-slate-100"><input v-model="formSupportsQrGeneration" type="checkbox" class="h-4 w-4">QR Generation</label>
                <label class="flex h-10 items-center gap-2 text-sm dark:text-slate-100"><input v-model="formSupportsConfirmCallback" type="checkbox" class="h-4 w-4">Payment Confirm</label>
                <label class="flex h-10 items-center gap-2 text-sm dark:text-slate-100"><input v-model="formSupportsSingleTxnVerify" type="checkbox" class="h-4 w-4">Transaction Inquiry</label>
                <label class="flex h-10 items-center gap-2 text-sm dark:text-slate-100"><input v-model="formSupportsSingleSlipVerify" type="checkbox" class="h-4 w-4">Slip Verification</label>
              </div>
            </div>
            <div class="border-t border-slate-200 pt-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 2: Configuration Payment Intent</div>
            <div class="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">Request (Platform → Provider)</div>
            <div class="grid gap-4 sm:grid-cols-4">
              <UFormField label="Issue Path"><UInput v-model="formIssuePath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Method"><select v-model="formIssueMethod" :class="nativeSelectClass"><option value="POST">POST</option><option value="GET">GET</option></select></UFormField>
              <UFormField label="API Key Header"><UInput v-model="formApiKeyHeader" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Auth Type"><select v-model="formAuthType" :class="nativeSelectClass"><option value="none">none</option><option value="bearer">bearer</option><option value="basic">basic</option></select></UFormField>
            </div>
            <div class="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">Response (Provider → Platform)</div>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="QR Payload Path"><UInput v-model="formResponseQrPayloadPath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Payment Intent Path"><UInput v-model="formResponsePaymentIntentPath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Reference Path"><UInput v-model="formResponseReferencePath" :ui="inputUi" class="w-full" /></UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Extra Headers (JSON)"><UTextarea v-model="formRequestExtraHeadersJson" :rows="4" class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
              <UFormField label="Payload Template (JSON)"><UTextarea v-model="formRequestPayloadTemplateJson" :rows="4" class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
            </div>
            <div class="border-t border-slate-200 pt-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 3: Configuration Payment Confirm</div>
            <div class="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">Payment Confirm Request (Provider → Platform)</div>
            <div class="grid gap-4 sm:grid-cols-4">
              <UFormField label="Secret Header"><UInput v-model="formWebhookSecretHeader" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Intent Path"><UInput v-model="formCallbackProviderPaymentIntentPath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Reference Path"><UInput v-model="formCallbackProviderReferencePath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Order Number Path"><UInput v-model="formCallbackOrderNumberPath" :ui="inputUi" class="w-full" /></UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-4">
              <UFormField label="Status Path"><UInput v-model="formCallbackStatusPath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Success Values (separate by comma)"><UInput v-model="formCallbackSuccessValues" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Failed Values (separate by comma)"><UInput v-model="formCallbackFailedValues" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Amount Path"><UInput v-model="formCallbackAmountPath" :ui="inputUi" class="w-full" /></UFormField>
            </div>
            <div class="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">Payment Confirm Response (Platform → Provider)</div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-4">
                <UFormField label="ACK Status Code"><UInput v-model="formAckStatusCode" type="number" :ui="inputUi" class="w-full" /></UFormField>
                <UFormField label="Reject Note Path"><UInput v-model="formCallbackRejectNotePath" :ui="inputUi" class="w-full" /></UFormField>
              </div>
              <UFormField label="ACK Body (JSON)"><UTextarea v-model="formAckBodyJson" :rows="6" class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
            </div>
            
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="createOpen = false">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="submit('create')">Create</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="editOpen" title="Edit Provider Service" :ui="{ content: 'w-full sm:max-w-6xl bg-white dark:bg-slate-900' }">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="formError" color="error" variant="soft" :title="formError" />
          <UAlert v-if="autoConfigNote" color="success" variant="soft" :title="autoConfigNote" />
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Display Name"><UInput v-model="formDisplayName" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Code"><UInput v-model="formCode" :ui="inputUi" class="w-full" readonly /></UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Provider (Type)">
                <select v-model="formTemplateCode" :class="nativeSelectClass" @change="applyTemplateByCode">
                  <option value="">Select provider template</option>
                  <option v-for="tpl in providerTemplates" :key="tpl.key" :value="tpl.key">
                    {{ tpl.label }} ({{ serviceShortLabel[tpl.serviceType] }})
                  </option>
                </select>
              </UFormField>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Status"><select v-model="formStatus" :class="nativeSelectClass"><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="DISABLED">DISABLED</option></select></UFormField>
                <label class="mt-6 flex h-10 items-center gap-2 rounded-md bg-amber-100 px-2 text-sm font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><input v-model="formIsDefault" type="checkbox" class="h-4 w-4">Set Default Service</label>
              </div>
            </div>
            <div class="space-y-3">
              <div class="grid gap-4 sm:grid-cols-4">
                <label class="flex h-10 items-center gap-2 text-sm dark:text-slate-100"><input v-model="formSupportsQrGeneration" type="checkbox" class="h-4 w-4">QR Generation</label>
                <label class="flex h-10 items-center gap-2 text-sm dark:text-slate-100"><input v-model="formSupportsConfirmCallback" type="checkbox" class="h-4 w-4">Payment Confirm</label>
                <label class="flex h-10 items-center gap-2 text-sm dark:text-slate-100"><input v-model="formSupportsSingleTxnVerify" type="checkbox" class="h-4 w-4">Transaction Inquiry</label>
                <label class="flex h-10 items-center gap-2 text-sm dark:text-slate-100"><input v-model="formSupportsSingleSlipVerify" type="checkbox" class="h-4 w-4">Slip Verification</label>
              </div>
            </div>
            <div class="border-t border-slate-200 pt-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 2: Configuration Payment Intent</div>
            <div class="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">Request (Platform → Provider)</div>
            <div class="grid gap-4 sm:grid-cols-4">
              <UFormField label="Issue Path"><UInput v-model="formIssuePath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Method"><select v-model="formIssueMethod" :class="nativeSelectClass"><option value="POST">POST</option><option value="GET">GET</option></select></UFormField>
              <UFormField label="API Key Header"><UInput v-model="formApiKeyHeader" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Auth Type"><select v-model="formAuthType" :class="nativeSelectClass"><option value="none">none</option><option value="bearer">bearer</option><option value="basic">basic</option></select></UFormField>
            </div>
            <div class="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">Response (Provider → Platform)</div>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="QR Payload Path"><UInput v-model="formResponseQrPayloadPath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Payment Intent Path"><UInput v-model="formResponsePaymentIntentPath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Reference Path"><UInput v-model="formResponseReferencePath" :ui="inputUi" class="w-full" /></UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Extra Headers (JSON)"><UTextarea v-model="formRequestExtraHeadersJson" :rows="4" class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
              <UFormField label="Payload Template (JSON)"><UTextarea v-model="formRequestPayloadTemplateJson" :rows="4" class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
            </div>
            <div class="border-t border-slate-200 pt-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 3: Configuration Payment Confirm</div>
            <div class="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">Payment Confirm Request (Provider → Platform)</div>
            <div class="grid gap-4 sm:grid-cols-4">
              <UFormField label="Secret Header"><UInput v-model="formWebhookSecretHeader" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Intent Path"><UInput v-model="formCallbackProviderPaymentIntentPath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Reference Path"><UInput v-model="formCallbackProviderReferencePath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Order Number Path"><UInput v-model="formCallbackOrderNumberPath" :ui="inputUi" class="w-full" /></UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-4">
              <UFormField label="Status Path"><UInput v-model="formCallbackStatusPath" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Success Values (separate by comma)"><UInput v-model="formCallbackSuccessValues" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Failed Values (separate by comma)"><UInput v-model="formCallbackFailedValues" :ui="inputUi" class="w-full" /></UFormField>
              <UFormField label="Amount Path"><UInput v-model="formCallbackAmountPath" :ui="inputUi" class="w-full" /></UFormField>
            </div>
            <div class="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">Payment Confirm Response (Platform → Provider)</div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-4">
                <UFormField label="ACK Status Code"><UInput v-model="formAckStatusCode" type="number" :ui="inputUi" class="w-full" /></UFormField>
                <UFormField label="Reject Note Path"><UInput v-model="formCallbackRejectNotePath" :ui="inputUi" class="w-full" /></UFormField>
              </div>
              <UFormField label="ACK Body (JSON)"><UTextarea v-model="formAckBodyJson" :rows="6" class="w-full font-mono text-sm" :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }" /></UFormField>
            </div>
            
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="editOpen = false">Cancel</UButton>
          <UButton color="primary" class="text-white" :loading="saving" @click="submit('edit')">Save</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Delete Provider Service" :ui="{ content: 'w-full sm:max-w-lg bg-white dark:bg-slate-900' }">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-slate-600 dark:text-slate-300">Type <span class="font-semibold">DELETE</span> to confirm.</p>
          <UInput v-model="deleteConfirmText" :ui="inputUi" />
          <UAlert v-if="deleteError" color="error" variant="soft" :title="deleteError" />
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
