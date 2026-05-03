<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

const ALL_MERCHANTS = '__ALL_MERCHANTS__'
const ALL_BRANCHES = '__ALL_BRANCHES__'

definePageMeta({
  middleware: 'platform-admin-auth'
})

type Tenant = { id: string; name: string; code: string }
type Merchant = { id: string; name: string; code: string; tenantId?: string }
type Branch = { id: string; name: string; code: string; merchantAccountId: string | null; tenantId?: string }
type ProviderConnection = { id: string; tenantId: string; code: string; displayName: string; providerCode: string; status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' }
type SlipVerifyConnection = { id: string; tenantId: string; code: string; displayName: string; providerCode: string; status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' }
type SelectOption = { label: string; value: string }
type BindingRef = { id: string; name: string; code: string }
type BillerItem = {
  id: string
  tenantId: string
  code: string
  displayName: string
  providerCode: string
  integrationMode: 'PLATFORM_QR' | 'PROVIDER_QR'
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED'
  priority: number
  billerId: string | null
  accountName: string | null
  bankName: string | null
  accountNumber: string | null
  promptPayTarget: string | null
  qrPaymentMode: 'promptpay' | 'maemanee' | 'maemanee_template' | null
  maeManeeShopId: string | null
  providerConnectionId: string | null
  providerConnection: { id: string; code: string; displayName: string; providerCode: string; status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' } | null
  slipVerifyConnectionId: string | null
  slipVerificationProvider: string | null
  slipVerifyConnection: { id: string; code: string; displayName: string; providerCode: string; status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' } | null
  updatedAt: string
  tenant: { id: string; name: string; code: string } | null
  tenantBindings: Array<{ id: string; priority: number; active: boolean; isDefault: boolean }>
  merchantBindings: Array<{ id: string; merchantAccountId: string; priority: number; active: boolean; merchantAccount: BindingRef | null }>
  branchBindings: Array<{ id: string; branchId: string; priority: number; active: boolean; branch: (BindingRef & { merchantAccountId: string | null }) | null }>
  canDelete: boolean
  linkedCount: number
}
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }

const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const search = ref('')

const filters = ref({
  tenantId: '',
  merchantAccountId: '',
  branchId: ''
})

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])
const items = ref<BillerItem[]>([])

const createOpen = ref(false)
const editOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const formId = ref('')
const formTenantId = ref('')
const formDisplayName = ref('')
const formProviderCode = ref<string>('INTERNAL')
const formIntegrationMode = ref<'PLATFORM_QR' | 'PROVIDER_QR'>('PLATFORM_QR')
const formQrMode = ref<'INTERNAL_QR' | 'PROVIDER_QR'>('INTERNAL_QR')
const formSettlementChannel = ref<'MAEMANEE' | 'KSHOP'>('MAEMANEE')
const formPaymentPlatform = ref<'PAYIQ' | 'KSHER'>('PAYIQ')
const formStatus = ref<'ACTIVE' | 'INACTIVE' | 'DISABLED'>('ACTIVE')
const formPriority = ref(100)
const formBillerId = ref('')
const formAccountName = ref('')
const formBankName = ref('')
const formAccountNumber = ref('')
const formPromptPayTarget = ref('')
const formPromptPayProxyType = ref<'mobileNumber' | 'nationalID' | 'taxID' | 'eWalletID' | 'bankAccount' | 'billerID'>('mobileNumber')
const formProviderConnectionId = ref('')
const formQrPaymentMode = ref<'promptpay' | 'maemanee' | 'maemanee_template'>('promptpay')
const formMaeManeeShopId = ref('')
const formSlipVerifyConnectionId = ref('')
const formMerchantIds = ref<string[]>([])
const formBranchIds = ref<string[]>([])
const formMerchants = ref<Merchant[]>([])
const formBranches = ref<Branch[]>([])
const formProviderConnections = ref<ProviderConnection[]>([])
const formSlipVerifyConnections = ref<SlipVerifyConnection[]>([])
const qrUploadInput = ref<HTMLInputElement | null>(null)
const qrUploading = ref(false)

const deleteOpen = ref(false)
const deleteSaving = ref(false)
const deleteError = ref('')
const deleteId = ref('')
const deleteName = ref('')
const deleteConfirmText = ref('')
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const inputUi = {
  base: 'h-10 bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500'
}
const nativeSelectClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'
const modalUi = {
  content: 'w-full sm:max-w-5xl bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 ring-1 ring-slate-200 dark:ring-slate-700',
  header: 'border-b border-slate-200 dark:border-slate-700',
  body: 'text-slate-900 dark:text-slate-100',
  footer: 'border-t border-slate-200 dark:border-slate-700'
}

const tenantOptions = computed<SelectOption[]>(() => tenants.value.map((item) => ({ label: item.name, value: item.id })))
const merchantOptions = computed<SelectOption[]>(() => merchants.value.map((item) => ({ label: item.name, value: item.id })))
const branchOptions = computed<SelectOption[]>(() => branches.value.map((item) => ({ label: item.name, value: item.id })))
const formMerchantOptions = computed<SelectOption[]>(() => [
  { label: 'All Merchants', value: ALL_MERCHANTS },
  ...formMerchants.value.map((item) => ({ label: item.name, value: item.id }))
])
const formBranchOptions = computed<SelectOption[]>(() => [
  { label: 'All Branches', value: ALL_BRANCHES },
  ...formBranches.value.map((item) => ({ label: item.name, value: item.id }))
])
const providerConnectionOptions = computed<SelectOption[]>(() => [
  { label: 'Select provider connection', value: '' },
  ...formProviderConnections.value.map((item) => ({ label: item.displayName, value: item.id }))
])
const selectedProviderConnection = computed(() => formProviderConnections.value.find(item => item.id === formProviderConnectionId.value) || null)
const slipVerifyConnectionOptions = computed<SelectOption[]>(() => [
  { label: 'None', value: '' },
  ...formSlipVerifyConnections.value.map((item) => ({ label: item.displayName, value: item.id }))
])
const promptPayProxyTypeOptions: Array<{ value: 'mobileNumber' | 'nationalID' | 'taxID' | 'eWalletID' | 'bankAccount' | 'billerID'; label: string }> = [
  { value: 'mobileNumber', label: 'mobileNumber (13)' },
  { value: 'nationalID', label: 'nationalID (13)' },
  { value: 'taxID', label: 'taxID (13)' },
  { value: 'eWalletID', label: 'eWalletID (15)' },
  { value: 'bankAccount', label: 'bankAccount (1-43)' },
  { value: 'billerID', label: 'billerID (15)' }
]
const promptPayProxyPlaceholder = computed(() => {
  if (formPromptPayProxyType.value === 'mobileNumber') return '13 chars'
  if (formPromptPayProxyType.value === 'nationalID') return '13 chars'
  if (formPromptPayProxyType.value === 'taxID') return '13 chars'
  if (formPromptPayProxyType.value === 'eWalletID') return '15 chars'
  if (formPromptPayProxyType.value === 'bankAccount') return 'BankCode(3)+AccountNo, 1-43 chars'
  return '15 chars'
})
const effectiveQrMode = computed<'INTERNAL_QR' | 'PROVIDER_QR'>(() => {
  if (formProviderConnectionId.value) return derivedQrMode.value
  return formQrMode.value
})
const showProviderFields = computed(() => effectiveQrMode.value === 'PROVIDER_QR')
const showMaeManeeQrFlow = computed(() => effectiveQrMode.value === 'INTERNAL_QR' && formSettlementChannel.value === 'MAEMANEE')
const showMaeManeeUpload = computed(() => effectiveQrMode.value === 'INTERNAL_QR' && formSettlementChannel.value === 'MAEMANEE')
const showMaeManeeFields = computed(() => effectiveQrMode.value === 'INTERNAL_QR' && formSettlementChannel.value === 'MAEMANEE' && formQrPaymentMode.value !== 'promptpay')
const showSlipVerifySelect = computed(() => effectiveQrMode.value === 'INTERNAL_QR')
const showPromptPayRecipient = computed(() =>
  effectiveQrMode.value === 'INTERNAL_QR' && formQrPaymentMode.value === 'promptpay'
)
const providerCodeForForm = computed<string>(() => {
  if (selectedProviderConnection.value?.providerCode) {
    return selectedProviderConnection.value.providerCode
  }
  if (formQrMode.value === 'INTERNAL_QR') {
    return formSettlementChannel.value === 'KSHOP' ? 'KSHOP' : 'MAEMANEE'
  }
  return 'PROMPTPAY'
})
const derivedQrMode = computed<'INTERNAL_QR' | 'PROVIDER_QR'>(() => {
  const code = String(selectedProviderConnection.value?.providerCode || '').toUpperCase()
  if (['MAEMANEE', 'KSHOP', 'SLIP2GO', 'INTERNAL'].includes(code)) return 'INTERNAL_QR'
  return 'PROVIDER_QR'
})
const reviewSummary = computed(() => {
  if (!formProviderConnectionId.value) return 'Select Provider Connection first'
  if (effectiveQrMode.value === 'INTERNAL_QR') {
    const channel = formSettlementChannel.value || '-'
    const slip = formSlipVerifyConnectionId.value || 'None'
    return `Internal QR -> ${channel} + Slip Verify (${slip})`
  }
  const platform = formPaymentPlatform.value || '-'
  const connection = formProviderConnectionId.value || 'Not selected'
  return `Provider QR -> ${platform} (${connection})`
})

watch(formProviderConnectionId, () => {
  if (!selectedProviderConnection.value) {
    formQrMode.value = 'INTERNAL_QR'
    return
  }
  const mode = derivedQrMode.value
  formQrMode.value = mode
  formIntegrationMode.value = mode === 'INTERNAL_QR' ? 'PLATFORM_QR' : 'PROVIDER_QR'
  if (mode === 'INTERNAL_QR') {
    formBillerId.value = ''
    const provider = String(selectedProviderConnection.value.providerCode || '').toUpperCase()
    formSettlementChannel.value = provider === 'KSHOP' ? 'KSHOP' : 'MAEMANEE'
  } else {
    formSlipVerifyConnectionId.value = ''
    formMaeManeeShopId.value = ''
    formPaymentPlatform.value = /ksh/i.test(String(selectedProviderConnection.value.displayName || '')) ? 'KSHER' : 'PAYIQ'
  }
})

function statusClass(status: string) {
  if (status === 'ACTIVE') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'INACTIVE') return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-GB')
}

function merchantAssignedLabels(item: BillerItem) {
  if (item.tenantBindings.length) return ['Tenant default']
  if (!item.merchantBindings.length) {
    const derived = Array.from(new Set(
      item.branchBindings
        .map((binding) => binding.branch?.merchantAccountId || '')
        .filter(Boolean)
        .map((merchantId) => merchants.value.find(entry => entry.id === merchantId)?.name || merchantId)
    ))
    return derived.length ? derived : ['-']
  }
  return item.merchantBindings.map((binding) => binding.merchantAccount?.name || binding.merchantAccountId)
}

function branchAssignedLabels(item: BillerItem) {
  if (item.tenantBindings.length) return ['All branches']
  if (!item.branchBindings.length) return item.merchantBindings.length ? ['All branches'] : ['-']
  return item.branchBindings.map((binding) => binding.branch?.name || binding.branchId)
}

function receiveToLines(item: BillerItem) {
  const lines: string[] = []
  if (item.accountName) lines.push(item.accountName)
  if (item.bankName || item.accountNumber) lines.push([item.bankName, item.accountNumber].filter(Boolean).join(' · '))
  if (item.promptPayTarget) lines.push(`PromptPay: ${item.promptPayTarget}`)
  return lines.length ? lines : ['-']
}

function assignmentScope(item: BillerItem) {
  if (item.tenantBindings.length) return 'Tenant Default'
  if (item.branchBindings.length) return 'Branch'
  if (item.merchantBindings.length) return 'Merchant'
  return '-'
}

function inferPromptPayProxyType(value: string | null | undefined): 'mobileNumber' | 'nationalID' | 'taxID' | 'eWalletID' | 'bankAccount' | 'billerID' {
  const normalized = String(value || '').trim()
  if (normalized.length === 15) return 'eWalletID'
  if (normalized.length === 13) return 'nationalID'
  return 'mobileNumber'
}

async function loadDelete(item: BillerItem) {
  deleteId.value = item.id
  deleteName.value = item.displayName
  deleteConfirmText.value = ''
  deleteError.value = ''
  deleteOpen.value = true
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>('/api/admin/tenants', { query: { page: 1, pageSize: 200 } })
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

async function loadFormMerchants() {
  if (!formTenantId.value) {
    formMerchants.value = []
    return
  }
  const response = await $fetch<PagingResponse<Merchant>>('/api/admin/merchants', {
    query: { tenantId: formTenantId.value, page: 1, pageSize: 200 }
  })
  formMerchants.value = response.items || []
}

async function loadFormBranches() {
  if (!formTenantId.value) {
    formBranches.value = []
    return
  }
  const merchantIds = formMerchantIds.value.filter(id => id !== ALL_MERCHANTS)
  const response = await $fetch<PagingResponse<Branch>>('/api/admin/branches', {
    query: {
      tenantId: formTenantId.value,
      ...(merchantIds.length === 1 ? { merchantAccountId: merchantIds[0] } : {}),
      page: 1,
      pageSize: 200
    }
  })
  formBranches.value = merchantIds.length > 1
    ? (response.items || []).filter(item => merchantIds.includes(String(item.merchantAccountId || '')))
    : (response.items || [])
}

async function loadFormProviderConnections() {
  if (!formTenantId.value) {
    formProviderConnections.value = []
    return
  }
  const response = await $fetch<PagingResponse<ProviderConnection>>('/api/admin/provider-connections', {
    query: {
      tenantId: formTenantId.value,
      page: 1,
      pageSize: 200
    }
  })
  formProviderConnections.value = response.items || []
}

async function loadFormSlipVerifyConnections() {
  if (!formTenantId.value) {
    formSlipVerifyConnections.value = []
    return
  }
  const response = await $fetch<PagingResponse<SlipVerifyConnection>>('/api/admin/slip-verify-connections', {
    query: {
      tenantId: formTenantId.value,
      page: 1,
      pageSize: 200
    }
  })
  formSlipVerifyConnections.value = response.items || []
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<PagingResponse<BillerItem>>('/api/admin/billers', {
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
  } catch (err) {
    items.value = []
    total.value = 0
    error.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || 'Failed to load billers'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formId.value = ''
  formTenantId.value = ''
  formDisplayName.value = ''
  formProviderCode.value = 'INTERNAL'
  formIntegrationMode.value = 'PLATFORM_QR'
  formQrMode.value = 'INTERNAL_QR'
  formSettlementChannel.value = 'MAEMANEE'
  formPaymentPlatform.value = 'PAYIQ'
  formStatus.value = 'ACTIVE'
  formPriority.value = 100
  formBillerId.value = ''
  formAccountName.value = ''
  formBankName.value = ''
  formAccountNumber.value = ''
  formPromptPayTarget.value = ''
  formPromptPayProxyType.value = 'mobileNumber'
  formProviderConnectionId.value = ''
  formQrPaymentMode.value = 'promptpay'
  formMaeManeeShopId.value = ''
  formSlipVerifyConnectionId.value = ''
  formMerchantIds.value = [ALL_MERCHANTS]
  formBranchIds.value = [ALL_BRANCHES]
  formMerchants.value = []
  formBranches.value = []
  formProviderConnections.value = []
  formSlipVerifyConnections.value = []
  formError.value = ''
}

function openCreate() {
  resetForm()
  createOpen.value = true
}

async function openEdit(item: BillerItem) {
  resetForm()
  formId.value = item.id
  formTenantId.value = item.tenantId
  formDisplayName.value = item.displayName
  formProviderCode.value = item.providerCode
  formIntegrationMode.value = item.integrationMode || 'PLATFORM_QR'
  formQrMode.value = (item.integrationMode === 'PROVIDER_QR' ? 'PROVIDER_QR' : 'INTERNAL_QR')
  if (formQrMode.value === 'INTERNAL_QR') {
    formSettlementChannel.value = (item.providerCode === 'KSHOP' ? 'KSHOP' : 'MAEMANEE')
  }
  if (formQrMode.value === 'PROVIDER_QR') {
    formPaymentPlatform.value = /ksh/i.test(String(item.providerConnection?.displayName || '')) ? 'KSHER' : 'PAYIQ'
  }
  formStatus.value = item.status
  formPriority.value = item.priority
  formBillerId.value = item.billerId || ''
  formAccountName.value = item.accountName || ''
  formBankName.value = item.bankName || ''
  formAccountNumber.value = item.accountNumber || ''
  formPromptPayTarget.value = item.promptPayTarget || ''
  formPromptPayProxyType.value = inferPromptPayProxyType(item.promptPayTarget)
  formProviderConnectionId.value = item.providerConnectionId || ''
  formQrPaymentMode.value = item.qrPaymentMode || 'promptpay'
  formMaeManeeShopId.value = item.maeManeeShopId || ''
  formSlipVerifyConnectionId.value = item.slipVerifyConnectionId || ''

  if (item.tenantBindings.length) {
    formMerchantIds.value = [ALL_MERCHANTS]
    formBranchIds.value = [ALL_BRANCHES]
  } else if (item.branchBindings.length) {
    const derivedMerchantIds = Array.from(new Set(
      item.branchBindings.map((binding) => binding.branch?.merchantAccountId || '').filter(Boolean)
    ))
    formMerchantIds.value = derivedMerchantIds.length ? derivedMerchantIds : [ALL_MERCHANTS]
    formBranchIds.value = item.branchBindings.map((binding) => binding.branchId)
  } else {
    formMerchantIds.value = item.merchantBindings.length ? item.merchantBindings.map((binding) => binding.merchantAccountId) : [ALL_MERCHANTS]
    formBranchIds.value = [ALL_BRANCHES]
  }

  await Promise.all([loadFormMerchants(), loadFormBranches(), loadFormProviderConnections(), loadFormSlipVerifyConnections()])
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
  if (!formProviderConnectionId.value) {
    formError.value = 'Provider connection is required'
    return
  }
  if (effectiveQrMode.value === 'PROVIDER_QR' && !formBillerId.value.trim()) {
    formError.value = 'Provider Biller ID is required for Provider QR mode'
    return
  }
  const promptPayTarget = formPromptPayTarget.value.trim()
  if (promptPayTarget) {
    const len = promptPayTarget.length
    if ((formPromptPayProxyType.value === 'mobileNumber' || formPromptPayProxyType.value === 'nationalID' || formPromptPayProxyType.value === 'taxID') && len !== 13) {
      formError.value = `${formPromptPayProxyType.value} must be exactly 13 characters`
      return
    }
    if ((formPromptPayProxyType.value === 'eWalletID' || formPromptPayProxyType.value === 'billerID') && len !== 15) {
      formError.value = `${formPromptPayProxyType.value} must be exactly 15 characters`
      return
    }
    if (formPromptPayProxyType.value === 'bankAccount' && (len < 1 || len > 43)) {
      formError.value = 'bankAccount must be 1 to 43 characters'
      return
    }
  }
  saving.value = true
  formError.value = ''
  try {
    const selectedMerchantIds = formMerchantIds.value.includes(ALL_MERCHANTS)
      ? []
      : formMerchantIds.value.filter(id => id !== ALL_MERCHANTS)
    const selectedBranchIds = formBranchIds.value.includes(ALL_BRANCHES)
      ? []
      : formBranchIds.value.filter(id => id !== ALL_BRANCHES)
    const mappedIntegrationMode = effectiveQrMode.value === 'INTERNAL_QR' ? 'PLATFORM_QR' : 'PROVIDER_QR'
    const mappedProviderCode = providerCodeForForm.value
    const payload = {
      tenantId: formTenantId.value,
      displayName: formDisplayName.value.trim(),
      providerCode: mappedProviderCode,
      integrationMode: mappedIntegrationMode,
      status: formStatus.value,
      priority: Number(formPriority.value),
      billerId: effectiveQrMode.value === 'PROVIDER_QR' ? (formBillerId.value.trim() || null) : null,
      providerConnectionId: formProviderConnectionId.value || null,
      accountName: formAccountName.value.trim() || null,
      bankName: formBankName.value.trim() || null,
      accountNumber: formAccountNumber.value.trim() || null,
      promptPayTarget: promptPayTarget || null,
      slipVerifyConnectionId: formSlipVerifyConnectionId.value || null,
      qrPaymentMode: effectiveQrMode.value === 'INTERNAL_QR' ? formQrPaymentMode.value : null,
      maeManeeShopId: formMaeManeeShopId.value.trim() || null,
      merchantIds: selectedBranchIds.length ? [] : selectedMerchantIds,
      branchIds: selectedBranchIds
    }

    if (mode === 'create') {
      await $fetch('/api/admin/billers', { method: 'POST', body: payload })
      closeCreate()
    } else {
      await $fetch(`/api/admin/billers/${formId.value}`, { method: 'PATCH', body: payload })
      closeEdit()
    }
    await loadData()
  } catch (err) {
    formError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || 'Failed to save biller'
  } finally {
    saving.value = false
  }
}

function parseTlv(input: string) {
  const nodes: Array<{ tag: string; value: string }> = []
  let cursor = 0
  while (cursor + 4 <= input.length) {
    const tag = input.slice(cursor, cursor + 2)
    const length = Number(input.slice(cursor + 2, cursor + 4))
    const valueStart = cursor + 4
    const valueEnd = valueStart + length
    if (!Number.isFinite(length) || valueEnd > input.length) break
    nodes.push({ tag, value: input.slice(valueStart, valueEnd) })
    cursor = valueEnd
  }
  return nodes
}

function parseMaeManeeQrPayload(payload: string) {
  const root = parseTlv(payload)
  const container = root.find(node => node.tag === '30' || node.tag === '29')
  if (!container) throw new Error('QR payload does not contain bill payment data')
  const nested = parseTlv(container.value)
  const aid = nested.find(node => node.tag === '00')?.value || ''
  if (!aid.includes('A000000677010112')) {
    throw new Error('QR payload is not a MaeManee bill payment QR')
  }
  return {
    shopId: nested.find(node => node.tag === '01')?.value || '',
    billerId: nested.find(node => node.tag === '02')?.value || ''
  }
}

async function decodeQrFile(file: File) {
  if (!('BarcodeDetector' in window)) {
    throw new Error('QR scan from image is not supported in this browser')
  }
  const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
  const bitmap = await createImageBitmap(file)
  try {
    const results = await detector.detect(bitmap)
    const rawValue = String(results?.[0]?.rawValue || '').trim()
    if (!rawValue) {
      throw new Error('No QR code found in uploaded image')
    }
    return rawValue
  } finally {
    bitmap.close()
  }
}

function triggerMaeManeeQrUpload() {
  qrUploadInput.value?.click()
}

async function onMaeManeeQrSelected(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  qrUploading.value = true
  formError.value = ''
  try {
    const payload = await decodeQrFile(file)
    const parsed = parseMaeManeeQrPayload(payload)
    formBillerId.value = parsed.billerId
    formMaeManeeShopId.value = parsed.shopId
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Unable to read MaeManee QR'
  } finally {
    qrUploading.value = false
    if (input) input.value = ''
  }
}

async function confirmDelete() {
  if (!deleteId.value || deleteConfirmText.value.trim() !== 'DELETE') {
    deleteError.value = 'Type DELETE to confirm'
    return
  }
  deleteSaving.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/admin/billers/${deleteId.value}`, {
      method: 'DELETE',
      body: {
        confirmText: 'DELETE',
        confirmName: deleteName.value
      }
    })
    deleteOpen.value = false
    await loadData()
  } catch (err) {
    deleteError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || 'Failed to delete biller'
  } finally {
    deleteSaving.value = false
  }
}

watch(() => filters.value.tenantId, async () => {
  filters.value.merchantAccountId = ''
  filters.value.branchId = ''
  await Promise.all([loadMerchants(), loadBranches()])
  page.value = 1
  await loadData()
})

watch(() => filters.value.merchantAccountId, async () => {
  filters.value.branchId = ''
  await loadBranches()
  page.value = 1
  await loadData()
})

watch(() => filters.value.branchId, async () => {
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

watch(formTenantId, async () => {
  formMerchantIds.value = [ALL_MERCHANTS]
  formBranchIds.value = [ALL_BRANCHES]
  formProviderConnectionId.value = ''
  formSlipVerifyConnectionId.value = ''
  await Promise.all([loadFormMerchants(), loadFormBranches(), loadFormProviderConnections(), loadFormSlipVerifyConnections()])
})

watch(formSettlementChannel, async () => {
  if (formSettlementChannel.value !== 'MAEMANEE') {
    formQrPaymentMode.value = 'promptpay'
    formMaeManeeShopId.value = ''
  }
  if (effectiveQrMode.value === 'INTERNAL_QR') {
    await loadFormSlipVerifyConnections()
  }
})

watch(formMerchantIds, async (value) => {
  if (value.includes(ALL_MERCHANTS) && value.length > 1) {
    formMerchantIds.value = [ALL_MERCHANTS]
    formBranchIds.value = [ALL_BRANCHES]
    return
  }
  await loadFormBranches()
})

watch(formBranchIds, (value) => {
  if (value.includes(ALL_BRANCHES) && value.length > 1) {
    formBranchIds.value = [ALL_BRANCHES]
  }
})

onMounted(async () => {
  await Promise.all([loadTenants(), loadMerchants(), loadBranches(), loadData()])
})
</script>

<template>
  <div class="space-y-4">
    <input ref="qrUploadInput" type="file" accept="image/*" class="hidden" @change="onMaeManeeQrSelected">

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-[240px]">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Billers</p>
          <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Biller Management</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Manage biller profiles, routing mode, and assignment priority across tenant, merchant, and branch.</p>
        </div>

        <div class="flex w-full justify-end">
          <div class="flex w-full gap-3 sm:grid-cols-2 xl:w-[1080px] xl:grid-cols-12">
            <UFormField label="Tenant" class="xl:col-span-2">
              <select v-model="filters.tenantId" :class="nativeSelectClass">
                <option value="">All tenants</option>
                <option v-for="item in tenantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Merchant" class="xl:col-span-2">
              <select v-model="filters.merchantAccountId" :class="nativeSelectClass">
                <option value="">All merchants</option>
                <option v-for="item in merchantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Branch" class="xl:col-span-2">
              <select v-model="filters.branchId" :class="nativeSelectClass">
                <option value="">All branches</option>
                <option v-for="item in branchOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Search" class="xl:col-span-4">
              <SearchInput v-model="search" placeholder="Search code/name/biller id..." />
            </UFormField>
          </div>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Biller List</h2>
            <p class="text-sm text-slate-500 dark:text-slate-300">{{ total }} items</p>
          </div>
          <UButton icon="i-lucide-plus" color="success" @click="openCreate">Create Biller</UButton>
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
              <th class="px-3 py-2 text-left font-semibold">Mode</th>
              <th class="px-3 py-2 text-left font-semibold">Merchant Assigned</th>
              <th class="px-3 py-2 text-left font-semibold">Branch Assigned</th>
              <th class="px-3 py-2 text-left font-semibold">Receive To</th>
              <th class="px-3 py-2 text-left font-semibold">Status</th>
              <th class="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="10" class="px-3 py-4 text-center text-slate-500 dark:text-slate-300">Loading billers...</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="10" class="px-3 py-4 text-center text-slate-500 dark:text-slate-300">No billers found.</td>
            </tr>
            <tr v-for="item in items" :key="item.id" class="border-t border-slate-200 dark:border-slate-800 align-top">
              <td class="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{{ item.code }}</td>
              <td class="px-3 py-2">
                <p class="font-medium text-slate-900 dark:text-white">{{ item.displayName }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ item.billerId || '-' }}</p>
              </td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ item.tenant?.name || item.tenantId }}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
                <p>{{ item.providerCode }}</p>
                <p v-if="item.providerConnection" class="text-xs text-slate-500 dark:text-slate-400">{{ item.providerConnection.displayName }}</p>
              </td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
                <p>{{ item.integrationMode }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ assignmentScope(item) }}</p>
              </td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
                <div class="space-y-1">
                  <p v-for="label in merchantAssignedLabels(item)" :key="label">{{ label }}</p>
                </div>
              </td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
                <div class="space-y-1">
                  <p v-for="label in branchAssignedLabels(item)" :key="label">{{ label }}</p>
                </div>
              </td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
                <div class="space-y-1">
                  <p v-for="line in receiveToLines(item)" :key="line">{{ line }}</p>
                </div>
              </td>
              <td class="px-3 py-2">
                <p class="font-semibold" :class="statusClass(item.status)">{{ item.status }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ formatDate(item.updatedAt) }}</p>
              </td>
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

    <UModal v-model:open="createOpen" title="Create Biller" :ui="modalUi">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="formError" color="error" variant="soft" :title="formError" />
          <div class="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 1: Define biller profile and tenant scope</div>
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

          <div class="grid gap-4 sm:grid-cols-[1fr_120px]">
            <UFormField label="Status">
              <select v-model="formStatus" :class="nativeSelectClass">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
            <UFormField label="Priority">
              <UInput v-model="formPriority" type="number" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>

          <div class="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 2: Select connection provider</div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Provider Connection">
              <select v-model="formProviderConnectionId" :class="nativeSelectClass">
                <option v-for="item in providerConnectionOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="QR Generation Mode">
              <UInput :model-value="formProviderConnectionId ? derivedQrMode : '-'" readonly :ui="inputUi" class="w-full" />
            </UFormField>
            <UFormField v-if="showProviderFields" label="Provider Biller ID">
              <UInput v-model="formBillerId" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>

          <div class="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 3: Define bank account and settlement information</div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Account Name">
              <UInput v-model="formAccountName" :ui="inputUi" class="w-full" />
            </UFormField>
            <div v-if="showPromptPayRecipient" class="grid gap-4 sm:grid-cols-2">
              <UFormField label="PromptPay Recipient Field">
                <select v-model="formPromptPayProxyType" :class="nativeSelectClass">
                  <option v-for="item in promptPayProxyTypeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </UFormField>
              <UFormField label="PromptPay Recipient Value">
                <UInput v-model="formPromptPayTarget" :placeholder="promptPayProxyPlaceholder" :ui="inputUi" class="w-full" />
              </UFormField>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Bank Name">
              <UInput v-model="formBankName" :ui="inputUi" class="w-full" />
            </UFormField>
            <UFormField label="Account Number">
              <UInput v-model="formAccountNumber" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>

          <div v-if="showMaeManeeQrFlow || showMaeManeeFields || showSlipVerifySelect" class="grid gap-4 sm:grid-cols-2">
            <UFormField v-if="showMaeManeeQrFlow" label="QR Flow">
              <select v-model="formQrPaymentMode" :class="nativeSelectClass">
                <option value="promptpay">PromptPay</option>
                <option value="maemanee">MaeManee</option>
                <option value="maemanee_template">MaeManee Template</option>
              </select>
            </UFormField>
            <UFormField v-if="showSlipVerifySelect" label="Slip Verify">
              <select v-model="formSlipVerifyConnectionId" :class="nativeSelectClass">
                <option v-for="item in slipVerifyConnectionOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField v-if="showMaeManeeFields" label="MaeManee Shop ID">
              <UInput v-model="formMaeManeeShopId" :ui="inputUi" class="w-full" />
            </UFormField>
            <div v-if="showMaeManeeUpload" class="flex items-end">
              <UButton color="secondary" variant="soft" :loading="qrUploading" icon="i-lucide-upload" @click="triggerMaeManeeQrUpload">Upload MaeManee QR</UButton>
            </div>
          </div>

          <div class="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 4: Assign to merchant and branch scope</div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Assign Merchants">
              <select v-model="formMerchantIds" multiple :class="[nativeSelectClass, 'h-28']">
                <option v-for="item in formMerchantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Assign Branches">
              <select v-model="formBranchIds" multiple :class="[nativeSelectClass, 'h-28']" :disabled="formMerchantIds.includes(ALL_MERCHANTS) && formMerchantIds.length === 1">
                <option v-for="item in formBranchOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
          </div>
          <div class="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <p class="text-xs font-semibold uppercase tracking-[0.15em]">Review</p>
            <p class="mt-1 font-medium">{{ reviewSummary }}</p>
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

    <UModal v-model:open="editOpen" title="Edit Biller" :ui="modalUi">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="formError" color="error" variant="soft" :title="formError" />
          <div class="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 1: Define biller profile and tenant scope</div>
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

          <div class="grid gap-4 sm:grid-cols-[1fr_120px]">
            <UFormField label="Status">
              <select v-model="formStatus" :class="nativeSelectClass">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
            <UFormField label="Priority">
              <UInput v-model="formPriority" type="number" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>

          <div class="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 2: Select connection provider</div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Provider Connection">
              <select v-model="formProviderConnectionId" :class="nativeSelectClass">
                <option v-for="item in providerConnectionOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="QR Generation Mode">
              <UInput :model-value="formProviderConnectionId ? derivedQrMode : '-'" readonly :ui="inputUi" class="w-full" />
            </UFormField>
            <UFormField v-if="showProviderFields" label="Provider Biller ID">
              <UInput v-model="formBillerId" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>

          <div class="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 3: Define bank account and settlement information</div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Account Name">
              <UInput v-model="formAccountName" :ui="inputUi" class="w-full" />
            </UFormField>
            <div v-if="showPromptPayRecipient" class="grid gap-4 sm:grid-cols-2">
              <UFormField label="PromptPay Recipient Field">
                <select v-model="formPromptPayProxyType" :class="nativeSelectClass">
                  <option v-for="item in promptPayProxyTypeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </UFormField>
              <UFormField label="PromptPay Recipient Value">
                <UInput v-model="formPromptPayTarget" :placeholder="promptPayProxyPlaceholder" :ui="inputUi" class="w-full" />
              </UFormField>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Bank Name">
              <UInput v-model="formBankName" :ui="inputUi" class="w-full" />
            </UFormField>
            <UFormField label="Account Number">
              <UInput v-model="formAccountNumber" :ui="inputUi" class="w-full" />
            </UFormField>
          </div>

          <div v-if="showMaeManeeQrFlow || showMaeManeeFields || showSlipVerifySelect" class="grid gap-4 sm:grid-cols-2">
            <UFormField v-if="showMaeManeeQrFlow" label="QR Flow">
              <select v-model="formQrPaymentMode" :class="nativeSelectClass">
                <option value="promptpay">PromptPay</option>
                <option value="maemanee">MaeManee</option>
                <option value="maemanee_template">MaeManee Template</option>
              </select>
            </UFormField>
            <UFormField v-if="showSlipVerifySelect" label="Slip Verify">
              <select v-model="formSlipVerifyConnectionId" :class="nativeSelectClass">
                <option v-for="item in slipVerifyConnectionOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField v-if="showMaeManeeFields" label="MaeManee Shop ID">
              <UInput v-model="formMaeManeeShopId" :ui="inputUi" class="w-full" />
            </UFormField>
            <div v-if="showMaeManeeUpload" class="flex items-end">
              <UButton color="secondary" variant="soft" :loading="qrUploading" icon="i-lucide-upload" @click="triggerMaeManeeQrUpload">Upload MaeManee QR</UButton>
            </div>
          </div>

          <div class="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Step 4: Assign to merchant and branch scope</div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Assign Merchants">
              <select v-model="formMerchantIds" multiple :class="[nativeSelectClass, 'h-28']">
                <option v-for="item in formMerchantOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
            <UFormField label="Assign Branches">
              <select v-model="formBranchIds" multiple :class="[nativeSelectClass, 'h-28']" :disabled="formMerchantIds.includes(ALL_MERCHANTS) && formMerchantIds.length === 1">
                <option v-for="item in formBranchOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </UFormField>
          </div>
          <div class="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <p class="text-xs font-semibold uppercase tracking-[0.15em]">Review</p>
            <p class="mt-1 font-medium">{{ reviewSummary }}</p>
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

    <UModal v-model:open="deleteOpen" title="Delete Biller" :ui="modalUi">
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
