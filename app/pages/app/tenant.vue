<script setup lang="ts">
definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})

type TenantDetailResponse = {
  tenant?: { id: string; code: string; name: string } | null
  selectedMerchantId: string
  selectedBranchId: string
  selectedAssetId: string
  selectedAssetType: string
  assetTypes: string[]
  merchants: Array<{
    id: string
    code: string
    name: string
    status: string
    environment?: string
    orderCount: number
    canDelete: boolean
    updatedAt: string
  }>
  branches: Array<{
    id: string
    code: string
    name: string
    status: string
    merchantAccountId: string | null
    orderCount: number
    canDelete: boolean
    updatedAt: string
  }>
  assets: Array<{
    id: string
    code: string
    name: string
    status: string
    kind: string
    branchId: string
    updatedAt: string
  }>
  devices: Array<{
    id: string
    deviceUid: string | null
    macAddress: string
    status: string
    fwVersion: string | null
    name: string | null
    model: string | null
    canDelete: boolean
  }>
  machines: Array<{
    id: string
    serialNo: string
    brand: string | null
    model: string | null
    status: string
    canDelete: boolean
  }>
  products: Array<{
    id: string
    code: string
    name: string
    kind: string
    amount: number | null
    durationMinutes: number | null
    serviceMode?: string
    serviceUnit?: string
    quantity?: number | null
    active: boolean
    locked: boolean
    updatedAt: string
  }>
  selectedAsset?: {
    id: string
    code: string
    name: string
    kind: string
    status: string
    updatedAt: string
    branch: {
      id: string
      name: string
      code: string
      merchantAccount: {
        id: string
        name: string
        code: string
      } | null
    } | null
    prices: Array<{
      id: string
      amount: number
      durationMinutes: number
      serviceMode?: string
      serviceUnit?: string
      quantity?: number | null
      sortOrder: number
      active: boolean
      orderCount: number
      canUnbind: boolean
      product: {
        id: string
        code: string
        name: string
        active: boolean
        amount: number | null
        durationMinutes: number | null
        serviceMode?: string
        serviceUnit?: string
        quantity?: number | null
      } | null
    }>
  } | null
  activeBinding?: {
    id: string
    startedAt: string
    reason: string | null
    iotDevice: {
      id: string
      deviceUid: string | null
      macAddress: string
      name: string | null
      model: string | null
      status: string
      fwVersion: string | null
    } | null
    machine: {
      id: string
      serialNo: string
      brand: string | null
      model: string | null
      status: string
    } | null
  } | null
}

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
  }>
  billers: Array<{
    id: string
    code: string
    displayName: string
    providerCode: 'SLIP2GO' | 'MAEMANEE' | 'KSHOP' | 'PROMPTPAY' | 'INTERNAL'
    status: 'ACTIVE' | 'INACTIVE' | 'DISABLED'
    priority: number
    billerId: string | null
    qrPaymentMode: 'promptpay' | 'maemanee' | 'maemanee_template' | null
    maeManeeReferencePrefix: string | null
    maeManeeShopId: string | null
    slipVerifyConnectionId?: string | null
    slipVerificationProvider: string | null
    merchantBindingCount: number
    branchBindingCount: number
    linkedCount: number
    canDelete: boolean
  }>
  paymentExpiryMinutes: number
}

const selectedMerchantId = ref('')
const selectedBranchId = ref('')
const selectedAssetType = ref('')
const selectedAssetId = ref('')
const merchantCreateOpen = ref(false)
const merchantCreateName = ref('')
const merchantCreateStatus = ref<'ACTIVE' | 'SUSPENDED' | 'DISABLED'>('ACTIVE')
const merchantCreateSaving = ref(false)
const merchantCreateError = ref('')
const merchantDeleteSavingId = ref('')
const merchantDeleteError = ref('')
const branchCreateOpen = ref(false)
const branchCreateName = ref('')
const branchCreateMerchantId = ref('')
const branchCreateStatus = ref<'ACTIVE' | 'SUSPENDED' | 'DISABLED'>('ACTIVE')
const branchCreateSaving = ref(false)
const branchCreateError = ref('')
const branchDeleteSavingId = ref('')
const branchDeleteError = ref('')
const deviceCreateOpen = ref(false)
const deviceCreateMacAddress = ref('')
const deviceCreateFwVersion = ref('')
const deviceCreateName = ref('')
const deviceCreateModel = ref('')
const deviceCreateSaving = ref(false)
const deviceCreateError = ref('')
const deviceDeleteSavingId = ref('')
const deviceDeleteError = ref('')
const machineCreateOpen = ref(false)
const machineCreateSerialNo = ref('')
const machineCreateBrand = ref('')
const machineCreateModel = ref('')
const machineCreateSaving = ref(false)
const machineCreateError = ref('')
const machineDeleteSavingId = ref('')
const machineDeleteError = ref('')
const merchantEditOpen = ref(false)
const merchantEditId = ref('')
const merchantEditName = ref('')
const merchantEditStatus = ref<'ACTIVE' | 'SUSPENDED' | 'DISABLED'>('ACTIVE')
const merchantEditEnvironment = ref<'TEST' | 'LIVE'>('TEST')
const merchantEditSaving = ref(false)
const merchantEditError = ref('')
const branchEditOpen = ref(false)
const branchEditId = ref('')
const branchEditName = ref('')
const branchEditStatus = ref<'ACTIVE' | 'SUSPENDED' | 'DISABLED'>('ACTIVE')
const branchEditMerchantId = ref('')
const branchEditSaving = ref(false)
const branchEditError = ref('')
const deleteConfirmOpen = ref(false)
const deleteConfirmType = ref<'merchant' | 'branch'>('merchant')
const deleteConfirmId = ref('')
const deleteConfirmName = ref('')
const deleteConfirmSaving = ref(false)
const governanceUserSavingId = ref('')
const governanceUserError = ref('')
const governanceBillerSavingId = ref('')
const governanceBillerError = ref('')
const billerIdVisibleMap = ref<Record<string, boolean>>({})
const billerFormOpen = ref(false)
const billerFormEditId = ref('')
const billerFormName = ref('')
const billerFormProvider = ref<'SLIP2GO' | 'MAEMANEE' | 'KSHOP' | 'PROMPTPAY' | 'INTERNAL'>('INTERNAL')
const billerFormStatus = ref<'ACTIVE' | 'INACTIVE' | 'DISABLED'>('ACTIVE')
const billerFormPriority = ref<number>(100)
const billerFormBillerId = ref('')
const billerFormQrPaymentMode = ref<'promptpay' | 'maemanee' | 'maemanee_template'>('promptpay')
const billerFormMaeManeeReferencePrefix = ref('')
const billerFormMaeManeeShopId = ref('')
const billerFormSlipVerificationProvider = ref<string>('SLIP2GO')
const billerFormSaving = ref(false)
const billerFormError = ref('')
const paymentExpiryInput = ref<number>(15)
const paymentExpirySaving = ref(false)
const paymentExpiryError = ref('')

const tenantEditOpen = ref(false)
const tenantEditName = ref('')
const tenantEditSaving = ref(false)
const tenantEditError = ref('')
const productCreateOpen = ref(false)
const productCreateSaving = ref(false)
const productCreateError = ref('')
const productCreateName = ref('')
const productCreateKind = ref('')
const productCreateAmount = ref<number | null>(null)
const productCreateDurationMinutes = ref<number | null>(null)
const productCreateServiceMode = ref('TIME')
const productCreateServiceUnit = ref('MINUTE')
const productCreateQuantity = ref<number | null>(null)
const productCreateStatus = ref<'ACTIVE' | 'DISABLED'>('ACTIVE')
const productEditId = ref('')
const bindProductOpen = ref(false)
const bindProductSaving = ref(false)
const bindProductError = ref('')
const bindProductId = ref('')
const unbindProductSavingId = ref('')
const unbindProductError = ref('')
const bindDeviceOpen = ref(false)
const bindDeviceSaving = ref(false)
const bindDeviceError = ref('')
const bindDeviceId = ref('')
const availableIotDevices = ref<Array<{ id: string; deviceUid: string | null; macAddress: string; name: string | null; model: string | null }>>([])
const bindMachineOpen = ref(false)
const bindMachineSaving = ref(false)
const bindMachineError = ref('')
const bindMachineId = ref('')
const availableMachines = ref<Array<{ id: string; serialNo: string; brand: string | null; model: string | null }>>([])
const { data: authData } = useAuth()

type AppPermission =
  | 'portal.settings.manage'
  | 'portal.user.manage'
  | 'portal.merchant.manage'
  | 'portal.branch.manage'
  | 'portal.asset.read'
  | 'portal.asset.manage.global'
  | 'portal.asset.manage.scoped'
const rolePermissionMap: Record<string, AppPermission[]> = {
  ADMIN: ['portal.settings.manage', 'portal.user.manage', 'portal.merchant.manage', 'portal.branch.manage', 'portal.asset.read', 'portal.asset.manage.global'],
  OWNER: ['portal.settings.manage', 'portal.user.manage', 'portal.merchant.manage', 'portal.branch.manage', 'portal.asset.read', 'portal.asset.manage.global', 'portal.asset.manage.scoped'],
  MANAGER: ['portal.asset.read', 'portal.asset.manage.scoped'],
  STAFF: ['portal.asset.read', 'portal.asset.manage.scoped']
}
const roleKey = computed(() => String(authData.value?.user?.role || '').trim().toUpperCase())
const isScopedRole = computed(() => roleKey.value === 'MANAGER' || roleKey.value === 'STAFF')
function can(permission: AppPermission) {
  return (rolePermissionMap[roleKey.value] || []).includes(permission)
}
const canManageSettings = computed(() => can('portal.settings.manage'))
const canManageUsers = computed(() => can('portal.user.manage'))
const canManageMerchant = computed(() => can('portal.merchant.manage'))
const canManageBranch = computed(() => can('portal.branch.manage'))
const canManageAssetGlobal = computed(() => can('portal.asset.manage.global'))
const canManageAssetScoped = computed(() => can('portal.asset.manage.scoped'))
const canManageAsset = computed(() => canManageAssetGlobal.value || canManageAssetScoped.value)
const assetAccessLabel = computed(() => {
  if (canManageAssetGlobal.value) return 'Global'
  if (canManageAssetScoped.value) return 'Scoped'
  return 'Read-only'
})

const queryParams = computed(() => ({
  merchantAccountId: selectedMerchantId.value || undefined,
  branchId: selectedBranchId.value || undefined,
  assetType: selectedAssetType.value || undefined,
  assetId: selectedAssetId.value || undefined
}))

const { data, pending, error, refresh } = await useFetch<TenantDetailResponse>('/api/app/tenant', {
  query: queryParams
})
const { data: governanceData, pending: governancePending, refresh: refreshGovernance } = await useFetch<GovernanceResponse>('/api/app/governance')
const { data: taxonomyData } = await useFetch<{
  productTypes: Array<{ code: string; name: string }>
  serviceModes: Array<{ code: string; name: string }>
  serviceUnits: Array<{ code: string; name: string; symbol?: string | null }>
}>('/api/app/products/taxonomy')

const tenantName = computed(() => data.value?.tenant?.name || '-')
const tenantCode = computed(() => data.value?.tenant?.code || '-')
const merchants = computed(() => data.value?.merchants || [])
const branches = computed(() => data.value?.branches || [])
const assets = computed(() => data.value?.assets || [])
const devices = computed(() => data.value?.devices || [])
const machines = computed(() => data.value?.machines || [])
const products = computed(() => data.value?.products || [])
const assetTypes = computed(() => data.value?.assetTypes || [])
const selectedAsset = computed(() => data.value?.selectedAsset || null)
const activeBinding = computed(() => data.value?.activeBinding || null)
const governanceUsers = computed(() => governanceData.value?.users || [])
const governanceBillers = computed(() => governanceData.value?.billers || [])
const governanceUserRows = computed(() => governanceUsers.value.map((item) => ({
  ...item,
  merchantAccountLabel: item.merchantAccount?.name || '-',
  emailVerifiedLabel: item.emailVerified ? 'YES' : 'NO',
  imageLabel: item.image ? 'YES' : 'NO',
  createdAtLabel: formatDateTime(item.createdAt),
  updatedAtLabel: formatDateTime(item.updatedAt),
  isActiveLabel: item.isActive ? 'ACTIVE' : 'INACTIVE'
})))
const merchantColumns = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'actions', header: 'Actions' }
]
const branchColumns = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'actions', header: 'Actions' }
]
const deviceColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'deviceUid', header: 'Device UID' },
  { accessorKey: 'macAddress', header: 'MAC' },
  { accessorKey: 'fwVersion', header: 'FW' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'actions', header: 'Action' }
]
const machineColumns = [
  { accessorKey: 'serialNo', header: 'Serial No' },
  { accessorKey: 'modelLabel', header: 'Model' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'actions', header: 'Action' }
]
const productColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'kind', header: 'Type' },
  { accessorKey: 'serviceLabel', header: 'Service' },
  { accessorKey: 'statusLabel', header: 'Status' },
  { accessorKey: 'lockLabel', header: 'Lock' },
  { accessorKey: 'actions', header: 'Action' }
]
const billerColumns = [
  { accessorKey: 'displayName', header: 'Name' },
  { accessorKey: 'providerCode', header: 'Provider' },
  { accessorKey: 'maeManeeShopIdLabel', header: 'Shop ID' },
  { accessorKey: 'qrPaymentModeLabel', header: 'QR Flow' },
  { accessorKey: 'referencePrefixLabel', header: 'Ref Prefix' },
  { accessorKey: 'billerIdMasked', header: 'Biller ID' },
  { accessorKey: 'priority', header: 'Priority' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'merchantBindingCount', header: 'Merchant Binding' },
  { accessorKey: 'branchBindingCount', header: 'Branch Binding' }
]
const governanceUserColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'merchantAccountLabel', header: 'Merchant Name' },
  { accessorKey: 'emailVerifiedLabel', header: 'EmailVerify' },
  { accessorKey: 'imageLabel', header: 'Image' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'isActiveLabel', header: 'IsActive' },
  { accessorKey: 'createdAtLabel', header: 'CreatedAt' },
  { accessorKey: 'updatedAtLabel', header: 'UpdatedAt' }
]
const machineRows = computed(() => machines.value.map(item => ({
  ...item,
  modelLabel: `${item.brand || '-'} / ${item.model || '-'}`
})))
const serviceModeOptions = computed(() => (taxonomyData.value?.serviceModes || []).map(item => ({ value: item.code, label: item.name || item.code })))
const serviceUnitOptions = computed(() => (taxonomyData.value?.serviceUnits || []).map(item => ({
  value: item.code,
  label: item.symbol ? `${item.name} (${item.symbol})` : item.name || item.code
})))
const productTypeOptions = computed(() => (taxonomyData.value?.productTypes || []).map(item => ({ value: item.code, label: item.name || item.code })))
function serviceUnitLabel(unit?: string | null) {
  const normalized = String(unit || '').toUpperCase()
  if (normalized === 'MINUTE') return 'min'
  if (normalized === 'GRAM') return 'g'
  if (normalized === 'LITER') return 'L'
  if (normalized === 'PIECE') return 'piece'
  if (normalized === 'SLOT') return 'slot'
  return 'unit'
}
function productServiceText(item: { amount?: number | null; durationMinutes?: number | null; quantity?: number | null; serviceMode?: string | null; serviceUnit?: string | null }) {
  const price = item.amount ?? '-'
  const qty = item.quantity ?? item.durationMinutes ?? null
  const unit = serviceUnitLabel(item.serviceUnit || (item.serviceMode === 'TIME' ? 'MINUTE' : 'UNIT'))
  return `${price} THB / ${qty ?? '-'} ${unit}`
}
const productRows = computed(() => products.value.map(item => ({
  ...item,
  serviceLabel: productServiceText(item),
  statusLabel: item.active ? 'ACTIVE' : 'DISABLED',
  lockLabel: item.locked ? 'LOCKED' : '-'
})))
const governanceBillerRows = computed(() => governanceBillers.value.map(item => ({
  ...item,
  billerIdMasked: billerIdDisplay(item.id, item.billerId, item.id),
  maeManeeShopIdLabel: item.maeManeeShopId || '-',
  qrPaymentModeLabel: item.qrPaymentMode || '-',
  referencePrefixLabel: item.maeManeeReferencePrefix || '-'
})))
const deviceCreateDeviceUid = computed(() => {
  const normalized = String(deviceCreateMacAddress.value || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '')
  if (normalized.length !== 12) return '-'
  const pairs = normalized.match(/.{1,2}/g) || []
  return pairs.reverse().join('')
})
const isProductEditMode = computed(() => Boolean(productEditId.value))
const editingProduct = computed(() => products.value.find(item => item.id === productEditId.value) || null)
const isEditingProductLocked = computed(() => Boolean(editingProduct.value?.locked))
const activeBoundProductIds = computed(() => {
  if (!selectedAsset.value) return new Set<string>()
  return new Set(
    selectedAsset.value.prices
      .filter(entry => entry.active && entry.product?.id)
      .map(entry => entry.product!.id)
  )
})
const bindableProducts = computed(() => {
  const assetKind = selectedAsset.value?.kind || ''
  if (!assetKind) return []
  return products.value.filter(item => item.active && item.kind === assetKind && !activeBoundProductIds.value.has(item.id))
})

const selectedMerchant = computed(() => {
  if (!merchants.value.length) return null
  return merchants.value.find(item => item.id === selectedMerchantId.value) || merchants.value[0] || null
})

const selectedBranch = computed(() => {
  if (!branches.value.length) return null
  return branches.value.find(item => item.id === selectedBranchId.value) || branches.value[0] || null
})

const merchantRows = computed(() => {
  if (!selectedMerchantId.value) return merchants.value
  return merchants.value.filter(item => item.id === selectedMerchantId.value)
})

const branchRows = computed(() => {
  let rows = branches.value
  if (selectedMerchantId.value) {
    rows = rows.filter(item => item.merchantAccountId === selectedMerchantId.value)
  }
  if (selectedBranchId.value) {
    rows = rows.filter(item => item.id === selectedBranchId.value)
  }
  return rows
})
const filterBranchOptions = computed(() => {
  if (!selectedMerchantId.value) return branches.value
  return branches.value.filter(item => item.merchantAccountId === selectedMerchantId.value)
})

watch(() => governanceData.value?.paymentExpiryMinutes, (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) paymentExpiryInput.value = v
}, { immediate: true })

watch(() => data.value?.selectedMerchantId, (v) => {
  if (v && !selectedMerchantId.value) selectedMerchantId.value = v
}, { immediate: true })

watch(() => data.value?.selectedBranchId, (v) => {
  if (v && !selectedBranchId.value) selectedBranchId.value = v
}, { immediate: true })

watch(() => data.value?.selectedAssetType, (v) => {
  if (v && !selectedAssetType.value) selectedAssetType.value = v
}, { immediate: true })

watch(() => data.value?.selectedAssetId, (v) => {
  if (v && !selectedAssetId.value) selectedAssetId.value = v
}, { immediate: true })

watch(merchants, (rows) => {
  if (selectedMerchantId.value && !rows.some(item => item.id === selectedMerchantId.value)) {
    selectedMerchantId.value = ''
  }
  if (isScopedRole.value && !selectedMerchantId.value && rows.length) {
    selectedMerchantId.value = rows[0].id
  }
}, { immediate: true })

watch(branches, (rows) => {
  if (selectedBranchId.value && !rows.some(item => item.id === selectedBranchId.value)) {
    selectedBranchId.value = ''
  }
  if (isScopedRole.value && selectedMerchantId.value && !selectedBranchId.value) {
    const scoped = rows.filter(item => item.merchantAccountId === selectedMerchantId.value)
    if (scoped.length) selectedBranchId.value = scoped[0].id
  }
}, { immediate: true })

watch(selectedMerchantId, (merchantId) => {
  if (!merchantId) return
  if (selectedBranchId.value && !filterBranchOptions.value.some(item => item.id === selectedBranchId.value)) {
    selectedBranchId.value = ''
  }
})

watch(assets, (rows) => {
  if (selectedAssetId.value && !rows.some(item => item.id === selectedAssetId.value)) {
    selectedAssetId.value = ''
  }
}, { immediate: true })

watch(productTypeOptions, (rows) => {
  if (productCreateKind.value && !rows.some(item => item.value === productCreateKind.value)) {
    productCreateKind.value = ''
  }
}, { immediate: true })

function statusTextClass(status?: string | null) {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'VERIFIED' || s === 'BOUND') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'SUSPENDED' || s === 'MAINTENANCE' || s === 'SPARE') return 'text-amber-600 dark:text-amber-400'
  if (s === 'DISABLED' || s === 'INACTIVE' || s === 'OFFLINE') return 'text-rose-600 dark:text-rose-400'
  return 'text-slate-700 dark:text-slate-200'
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-GB')
}

function openTenantEdit() {
  if (!canManageSettings.value) return
  tenantEditName.value = tenantName.value === '-' ? '' : tenantName.value
  tenantEditError.value = ''
  tenantEditOpen.value = true
}

function closeTenantEdit() {
  tenantEditOpen.value = false
  tenantEditSaving.value = false
  tenantEditError.value = ''
}

async function saveTenantName() {
  if (!canManageSettings.value) return
  tenantEditSaving.value = true
  tenantEditError.value = ''
  try {
    const name = tenantEditName.value.trim()
    if (!name) throw new Error('Tenant name is required.')

    await $fetch('/api/app/tenant', {
      method: 'PATCH',
      body: { name }
    })

    await refresh()
    closeTenantEdit()
  } catch (err) {
    tenantEditError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to update tenant name'
  } finally {
    tenantEditSaving.value = false
  }
}

function openCreateMerchant() {
  if (!canManageMerchant.value) return
  merchantCreateError.value = ''
  merchantCreateName.value = ''
  merchantCreateStatus.value = 'ACTIVE'
  merchantCreateOpen.value = true
}

function closeCreateMerchant() {
  merchantCreateOpen.value = false
  merchantCreateSaving.value = false
  merchantCreateError.value = ''
}

async function submitCreateMerchant() {
  if (!canManageMerchant.value) return
  merchantCreateSaving.value = true
  merchantCreateError.value = ''
  try {
    const name = merchantCreateName.value.trim()
    if (!name) throw new Error('Merchant name is required.')
    await $fetch('/api/app/merchants', {
      method: 'POST',
      body: {
        name,
        status: merchantCreateStatus.value
      }
    })
    await refresh()
    closeCreateMerchant()
  } catch (err) {
    merchantCreateError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to create merchant'
  } finally {
    merchantCreateSaving.value = false
  }
}

function openMerchantEdit(item: { id: string; name: string; status: string; environment?: string }) {
  if (!canManageMerchant.value) return
  merchantEditError.value = ''
  merchantEditId.value = item.id
  merchantEditName.value = item.name
  merchantEditStatus.value = (item.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED') || 'ACTIVE'
  merchantEditEnvironment.value = (item.environment as 'TEST' | 'LIVE') || 'TEST'
  merchantEditOpen.value = true
}

function closeMerchantEdit() {
  merchantEditOpen.value = false
  merchantEditSaving.value = false
  merchantEditError.value = ''
}

async function submitMerchantEdit() {
  if (!canManageMerchant.value) return
  merchantEditSaving.value = true
  merchantEditError.value = ''
  try {
    const name = merchantEditName.value.trim()
    if (!name) throw new Error('Merchant name is required.')
    await $fetch(`/api/app/merchants/${merchantEditId.value}`, {
      method: 'PATCH',
      body: {
        name,
        status: merchantEditStatus.value,
        environment: merchantEditEnvironment.value
      }
    })
    await refresh()
    closeMerchantEdit()
  } catch (err) {
    merchantEditError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to update merchant'
  } finally {
    merchantEditSaving.value = false
  }
}

function askDeleteMerchant(item: { id: string; name: string; canDelete: boolean }) {
  if (!canManageMerchant.value) return
  if (!item.canDelete) return
  deleteConfirmType.value = 'merchant'
  deleteConfirmId.value = item.id
  deleteConfirmName.value = item.name
  deleteConfirmOpen.value = true
}

function openCreateBranch() {
  if (!canManageBranch.value) return
  branchCreateError.value = ''
  branchCreateName.value = ''
  branchCreateMerchantId.value = selectedMerchantId.value || ''
  branchCreateStatus.value = 'ACTIVE'
  branchCreateOpen.value = true
}

function closeCreateBranch() {
  branchCreateOpen.value = false
  branchCreateSaving.value = false
  branchCreateError.value = ''
}

async function submitCreateBranch() {
  if (!canManageBranch.value) return
  branchCreateSaving.value = true
  branchCreateError.value = ''
  try {
    const name = branchCreateName.value.trim()
    if (!name) throw new Error('Branch name is required.')
    await $fetch('/api/app/branches', {
      method: 'POST',
      body: {
        name,
        merchantAccountId: branchCreateMerchantId.value || null,
        status: branchCreateStatus.value
      }
    })
    await refresh()
    closeCreateBranch()
  } catch (err) {
    branchCreateError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to create branch'
  } finally {
    branchCreateSaving.value = false
  }
}

function openBranchEdit(item: { id: string; name: string; status: string; merchantAccountId: string | null }) {
  if (!canManageBranch.value) return
  branchEditError.value = ''
  branchEditId.value = item.id
  branchEditName.value = item.name
  branchEditStatus.value = (item.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED') || 'ACTIVE'
  branchEditMerchantId.value = item.merchantAccountId || ''
  branchEditOpen.value = true
}

function closeBranchEdit() {
  branchEditOpen.value = false
  branchEditSaving.value = false
  branchEditError.value = ''
}

async function submitBranchEdit() {
  if (!canManageBranch.value) return
  branchEditSaving.value = true
  branchEditError.value = ''
  try {
    const name = branchEditName.value.trim()
    if (!name) throw new Error('Branch name is required.')
    await $fetch(`/api/app/branches/${branchEditId.value}`, {
      method: 'PATCH',
      body: {
        name,
        status: branchEditStatus.value,
        merchantAccountId: branchEditMerchantId.value || null
      }
    })
    await refresh()
    closeBranchEdit()
  } catch (err) {
    branchEditError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to update branch'
  } finally {
    branchEditSaving.value = false
  }
}

function askDeleteBranch(item: { id: string; name: string; canDelete: boolean }) {
  if (!canManageBranch.value) return
  if (!item.canDelete) return
  deleteConfirmType.value = 'branch'
  deleteConfirmId.value = item.id
  deleteConfirmName.value = item.name
  deleteConfirmOpen.value = true
}

function closeDeleteConfirm() {
  deleteConfirmOpen.value = false
  deleteConfirmSaving.value = false
}

async function submitDeleteConfirm() {
  if ((deleteConfirmType.value === 'merchant' && !canManageMerchant.value) || (deleteConfirmType.value === 'branch' && !canManageBranch.value)) return
  if (!deleteConfirmId.value) return
  deleteConfirmSaving.value = true
  try {
    if (deleteConfirmType.value === 'merchant') {
      merchantDeleteSavingId.value = deleteConfirmId.value
      merchantDeleteError.value = ''
      await $fetch(`/api/app/merchants/${deleteConfirmId.value}`, { method: 'DELETE' })
      if (selectedMerchantId.value === deleteConfirmId.value) selectedMerchantId.value = ''
    } else {
      branchDeleteSavingId.value = deleteConfirmId.value
      branchDeleteError.value = ''
      await $fetch(`/api/app/branches/${deleteConfirmId.value}`, { method: 'DELETE' })
      if (selectedBranchId.value === deleteConfirmId.value) selectedBranchId.value = ''
    }
    await refresh()
    closeDeleteConfirm()
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Delete failed'
    if (deleteConfirmType.value === 'merchant') merchantDeleteError.value = message
    else branchDeleteError.value = message
  } finally {
    merchantDeleteSavingId.value = ''
    branchDeleteSavingId.value = ''
    deleteConfirmSaving.value = false
  }
}

function openCreateDevice() {
  if (!canManageAsset.value) return
  deviceCreateError.value = ''
  deviceCreateMacAddress.value = ''
  deviceCreateFwVersion.value = ''
  deviceCreateName.value = ''
  deviceCreateModel.value = ''
  deviceCreateOpen.value = true
}

function closeCreateDevice() {
  deviceCreateOpen.value = false
  deviceCreateSaving.value = false
  deviceCreateError.value = ''
}

async function submitCreateDevice() {
  if (!canManageAsset.value) return
  deviceCreateSaving.value = true
  deviceCreateError.value = ''
  try {
    const macAddress = deviceCreateMacAddress.value.trim()
    const fwVersion = deviceCreateFwVersion.value.trim()
    if (!macAddress) throw new Error('MAC address is required.')
    if (!fwVersion) throw new Error('FW version is required.')

    await $fetch('/api/app/devices', {
      method: 'POST',
      body: {
        macAddress,
        fwVersion,
        name: deviceCreateName.value.trim() || null,
        model: deviceCreateModel.value.trim() || null
      }
    })
    await refresh()
    closeCreateDevice()
  } catch (err) {
    deviceCreateError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to create device'
  } finally {
    deviceCreateSaving.value = false
  }
}

async function deleteDevice(item: { id: string; canDelete: boolean }) {
  if (!canManageAsset.value) return
  if (!item.canDelete) return
  const ok = globalThis.confirm?.('Delete this device?') ?? false
  if (!ok) return
  deviceDeleteSavingId.value = item.id
  deviceDeleteError.value = ''
  try {
    await $fetch(`/api/app/devices/${item.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    deviceDeleteError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to delete device'
  } finally {
    deviceDeleteSavingId.value = ''
  }
}

function openCreateMachine() {
  if (!canManageAsset.value) return
  machineCreateError.value = ''
  machineCreateSerialNo.value = ''
  machineCreateBrand.value = ''
  machineCreateModel.value = ''
  machineCreateOpen.value = true
}

function closeCreateMachine() {
  machineCreateOpen.value = false
  machineCreateSaving.value = false
  machineCreateError.value = ''
}

async function submitCreateMachine() {
  if (!canManageAsset.value) return
  machineCreateSaving.value = true
  machineCreateError.value = ''
  try {
    const serialNo = machineCreateSerialNo.value.trim()
    if (!serialNo) throw new Error('Serial no is required.')
    await $fetch('/api/app/machine-units', {
      method: 'POST',
      body: {
        serialNo,
        brand: machineCreateBrand.value.trim() || null,
        model: machineCreateModel.value.trim() || null
      }
    })
    await refresh()
    closeCreateMachine()
  } catch (err) {
    machineCreateError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to create machine'
  } finally {
    machineCreateSaving.value = false
  }
}

async function deleteMachine(item: { id: string; canDelete: boolean }) {
  if (!canManageAsset.value) return
  if (!item.canDelete) return
  const ok = globalThis.confirm?.('Delete this machine?') ?? false
  if (!ok) return
  machineDeleteSavingId.value = item.id
  machineDeleteError.value = ''
  try {
    await $fetch(`/api/app/machine-units/${item.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    machineDeleteError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to delete machine'
  } finally {
    machineDeleteSavingId.value = ''
  }
}

async function updateGovernanceUser(item: { id: string; role: 'OWNER' | 'MANAGER' | 'STAFF'; isActive: boolean }, patch: { role?: 'OWNER' | 'MANAGER' | 'STAFF'; isActive?: boolean }) {
  if (!canManageUsers.value) return
  governanceUserSavingId.value = item.id
  governanceUserError.value = ''
  try {
    await $fetch(`/api/app/users/${item.id}`, {
      method: 'PATCH',
      body: {
        role: patch.role ?? item.role,
        isActive: patch.isActive ?? item.isActive
      }
    })
    await refreshGovernance()
  } catch (err) {
    governanceUserError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to update user'
  } finally {
    governanceUserSavingId.value = ''
  }
}

function onGovernanceRoleChange(item: { id: string; role: 'OWNER' | 'MANAGER' | 'STAFF'; isActive: boolean }, event: Event) {
  const value = String((event.target as HTMLSelectElement | null)?.value || item.role)
  if (value === 'OWNER' || value === 'MANAGER' || value === 'STAFF') {
    updateGovernanceUser(item, { role: value })
  }
}

function openCreateBiller() {
  if (!canManageSettings.value) return
  billerFormEditId.value = ''
  billerFormName.value = ''
  billerFormProvider.value = 'INTERNAL'
  billerFormStatus.value = 'ACTIVE'
  billerFormPriority.value = 100
  billerFormBillerId.value = ''
  billerFormQrPaymentMode.value = 'promptpay'
  billerFormMaeManeeReferencePrefix.value = ''
  billerFormMaeManeeShopId.value = ''
  billerFormSlipVerificationProvider.value = 'SLIP2GO'
  billerFormError.value = ''
  billerFormOpen.value = true
}

function toggleBillerIdVisibility(id: string) {
  billerIdVisibleMap.value = {
    ...billerIdVisibleMap.value,
    [id]: !billerIdVisibleMap.value[id]
  }
}

function billerIdDisplay(rowId: string, billerId: string | null | undefined, fallbackId: string) {
  const source = String(billerId || fallbackId || '')
  if (!source) return '-'
  if (billerIdVisibleMap.value[rowId]) return source
  if (source.length <= 10) return `${source.slice(0, 3)}***${source.slice(-2)}`
  return `${source.slice(0, 6)}***${source.slice(-4)}`
}

function openEditBiller(item: { id: string; displayName: string; providerCode: 'SLIP2GO' | 'MAEMANEE' | 'KSHOP' | 'PROMPTPAY' | 'INTERNAL'; status: 'ACTIVE' | 'INACTIVE' | 'DISABLED'; priority: number; billerId: string | null; qrPaymentMode: 'promptpay' | 'maemanee' | 'maemanee_template' | null; maeManeeReferencePrefix: string | null; maeManeeShopId: string | null; slipVerifyConnectionId?: string | null; slipVerificationProvider: string | null }) {
  if (!canManageSettings.value) return
  billerFormEditId.value = item.id
  billerFormName.value = item.displayName
  billerFormProvider.value = item.providerCode
  billerFormStatus.value = item.status
  billerFormPriority.value = item.priority
  billerFormBillerId.value = item.billerId || ''
  billerFormQrPaymentMode.value = item.qrPaymentMode || 'promptpay'
  billerFormMaeManeeReferencePrefix.value = item.maeManeeReferencePrefix || ''
  billerFormMaeManeeShopId.value = item.maeManeeShopId || ''
  billerFormSlipVerificationProvider.value = item.slipVerificationProvider || 'SLIP2GO'
  billerFormError.value = ''
  billerFormOpen.value = true
}

function closeBillerForm() {
  billerFormOpen.value = false
  billerFormSaving.value = false
  billerFormError.value = ''
}

async function submitBillerForm() {
  if (!canManageSettings.value) return
  billerFormSaving.value = true
  billerFormError.value = ''
  try {
    const displayName = billerFormName.value.trim()
    if (!displayName) throw new Error('Biller name is required.')
    if (!billerFormEditId.value) throw new Error('Create biller is disabled.')
    await $fetch(`/api/app/billers/${billerFormEditId.value}`, {
      method: 'PATCH',
      body: {
        displayName,
        priority: Number(billerFormPriority.value),
        billerId: billerFormBillerId.value.trim() || null,
        qrPaymentMode: billerFormQrPaymentMode.value || null,
        maeManeeReferencePrefix: billerFormMaeManeeReferencePrefix.value.trim() || null,
        maeManeeShopId: billerFormMaeManeeShopId.value.trim() || null,
        slipVerificationProvider: billerFormSlipVerificationProvider.value || null
      }
    })
    await refreshGovernance()
    closeBillerForm()
  } catch (err) {
    billerFormError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to save biller'
  } finally {
    billerFormSaving.value = false
  }
}

async function deleteBiller(item: { id: string; canDelete?: boolean }) {
  if (!canManageSettings.value) return
  if (item.canDelete === false) return
  governanceBillerSavingId.value = item.id
  governanceBillerError.value = ''
  try {
    await $fetch(`/api/app/billers/${item.id}`, { method: 'DELETE' })
    await refreshGovernance()
  } catch (err) {
    governanceBillerError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to delete biller'
  } finally {
    governanceBillerSavingId.value = ''
  }
}

async function savePaymentExpiry() {
  if (!canManageSettings.value) return
  paymentExpirySaving.value = true
  paymentExpiryError.value = ''
  try {
    const minutes = Number(paymentExpiryInput.value)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      throw new Error('Payment expiry must be 1-1440 minutes')
    }
    await $fetch('/api/app/settings/payment-expiry', {
      method: 'POST',
      body: { paymentExpiryMinutes: minutes }
    })
    await refreshGovernance()
  } catch (err) {
    paymentExpiryError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to save payment expiry'
  } finally {
    paymentExpirySaving.value = false
  }
}

async function openCreateAsset() {
  const tenantId = data.value?.tenant?.id || ''
  if (!tenantId) return
  const query = new URLSearchParams()
  query.set('tenantId', tenantId)
  if (selectedMerchantId.value) query.set('merchantAccountId', selectedMerchantId.value)
  if (selectedBranchId.value) query.set('branchId', selectedBranchId.value)
  await navigateTo(`/admin/assets?${query.toString()}`)
}

async function openBindDeviceModal() {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value) return
  bindDeviceSaving.value = true
  bindDeviceError.value = ''
  try {
    const result = await $fetch<{ items: Array<{ id: string; deviceUid: string | null; macAddress: string; name: string | null; model: string | null }> }>(`/api/app/assets/${selectedAssetId.value}/available-iot-devices`)
    availableIotDevices.value = result.items || []
    bindDeviceId.value = availableIotDevices.value[0]?.id || ''
    bindDeviceOpen.value = true
  } catch (err) {
    bindDeviceError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to load NEW/SPARE IoT devices'
  } finally {
    bindDeviceSaving.value = false
  }
}

function closeBindDeviceModal() {
  bindDeviceOpen.value = false
  bindDeviceSaving.value = false
  bindDeviceError.value = ''
}

async function submitBindDevice() {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value || !bindDeviceId.value) return
  bindDeviceSaving.value = true
  bindDeviceError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/replace-device`, {
      method: 'POST',
      body: {
        iotDeviceId: bindDeviceId.value,
        reason: activeBinding.value?.iotDevice ? 'portal-replace-device' : 'portal-bind-device'
      }
    })
    await refresh()
    closeBindDeviceModal()
  } catch (err) {
    bindDeviceError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to bind IoT device'
  } finally {
    bindDeviceSaving.value = false
  }
}

async function openBindMachineModal() {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value) return
  bindMachineSaving.value = true
  bindMachineError.value = ''
  try {
    const result = await $fetch<{ items: Array<{ id: string; serialNo: string; brand: string | null; model: string | null }> }>(`/api/app/assets/${selectedAssetId.value}/available-machine-units`)
    availableMachines.value = result.items || []
    bindMachineId.value = availableMachines.value[0]?.id || ''
    bindMachineOpen.value = true
  } catch (err) {
    bindMachineError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to load NEW/SPARE machines'
  } finally {
    bindMachineSaving.value = false
  }
}

function closeBindMachineModal() {
  bindMachineOpen.value = false
  bindMachineSaving.value = false
  bindMachineError.value = ''
}

async function submitBindMachine() {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value || !bindMachineId.value) return
  bindMachineSaving.value = true
  bindMachineError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/replace-machine`, {
      method: 'POST',
      body: {
        machineId: bindMachineId.value,
        reason: activeBinding.value?.machine ? 'portal-replace-machine' : 'portal-bind-machine'
      }
    })
    await refresh()
    closeBindMachineModal()
  } catch (err) {
    bindMachineError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to bind machine'
  } finally {
    bindMachineSaving.value = false
  }
}

async function openAssetProductBinding() {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value) return
  bindProductError.value = ''
  bindProductId.value = bindableProducts.value[0]?.id || ''
  bindProductOpen.value = true
}

async function openCreateProduct() {
  if (!canManageAsset.value) return
  productEditId.value = ''
  productCreateName.value = ''
  productCreateKind.value = productTypeOptions.value[0]?.value || ''
  productCreateAmount.value = null
  productCreateDurationMinutes.value = null
  productCreateServiceMode.value = 'TIME'
  productCreateServiceUnit.value = 'MINUTE'
  productCreateQuantity.value = null
  productCreateStatus.value = 'ACTIVE'
  productCreateError.value = ''
  productCreateOpen.value = true
}

function openEditProduct(product: { id: string; name: string; kind: string; amount: number | null; durationMinutes: number | null; serviceMode?: string; serviceUnit?: string; quantity?: number | null; active: boolean }) {
  if (!canManageAsset.value) return
  productEditId.value = product.id
  productCreateName.value = product.name
  productCreateKind.value = product.kind
  productCreateAmount.value = product.amount
  productCreateDurationMinutes.value = product.durationMinutes
  productCreateServiceMode.value = product.serviceMode || 'TIME'
  productCreateServiceUnit.value = product.serviceUnit || 'MINUTE'
  productCreateQuantity.value = product.quantity ?? product.durationMinutes
  productCreateStatus.value = product.active ? 'ACTIVE' : 'DISABLED'
  productCreateError.value = ''
  productCreateOpen.value = true
}

function closeCreateProduct() {
  productEditId.value = ''
  productCreateOpen.value = false
  productCreateSaving.value = false
  productCreateError.value = ''
}

function closeBindProduct() {
  bindProductOpen.value = false
  bindProductSaving.value = false
  bindProductError.value = ''
}

async function submitBindProduct() {
  if (!canManageAsset.value) return
  bindProductSaving.value = true
  bindProductError.value = ''
  try {
    if (!selectedAssetId.value) throw new Error('Please select an asset first.')
    if (!bindProductId.value) throw new Error('Please select a product.')
    await $fetch(`/api/app/assets/${selectedAssetId.value}/products`, {
      method: 'POST',
      body: { productId: bindProductId.value }
    })
    await refresh()
    closeBindProduct()
  } catch (err) {
    bindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to bind product'
  } finally {
    bindProductSaving.value = false
  }
}

async function unbindProduct(productId: string) {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value || !productId) return
  unbindProductSavingId.value = productId
  unbindProductError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/products/${productId}`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (err) {
    unbindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to unbind product'
  } finally {
    unbindProductSavingId.value = ''
  }
}

async function rebindProduct(productId: string) {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value || !productId) return
  unbindProductSavingId.value = productId
  unbindProductError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/products`, {
      method: 'POST',
      body: { productId }
    })
    await refresh()
  } catch (err) {
    unbindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to rebind product'
  } finally {
    unbindProductSavingId.value = ''
  }
}

async function submitCreateProduct() {
  if (!canManageAsset.value) return
  productCreateSaving.value = true
  productCreateError.value = ''
  try {
    const name = productCreateName.value.trim()
    const kind = productCreateKind.value.trim()
    const amount = Number(productCreateAmount.value)
    const quantity = Number(productCreateQuantity.value)
    const serviceMode = productCreateServiceMode.value
    const serviceUnit = productCreateServiceUnit.value
    const durationMinutes = serviceMode === 'TIME' && serviceUnit === 'MINUTE' ? quantity : undefined
    const status = productCreateStatus.value
    if (!name) throw new Error('Product name is required.')
    if (!kind) throw new Error('Product type is required.')
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Price is required.')
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Service quantity is required.')
    if (isProductEditMode.value) {
      if (isEditingProductLocked.value) {
        throw new Error('This product is locked because completed orders reference it.')
      }
      await $fetch(`/api/app/products/${productEditId.value}`, {
        method: 'PATCH',
        body: { name, kind, amount, durationMinutes, serviceMode, serviceUnit, quantity, status }
      })
    } else {
      await $fetch('/api/app/products', {
        method: 'POST',
        body: {
          name,
          kind,
          amount,
          durationMinutes,
          serviceMode,
          serviceUnit,
          quantity,
          status
        }
      })
    }

    await refresh()
    closeCreateProduct()
  } catch (err) {
    productCreateError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to create product'
  } finally {
    productCreateSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Tenant Workspace</h3>
        <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ tenantName }}</h2>
        <div class="flex items-center gap-2">
          <p class="text-xs text-slate-500 dark:text-slate-400">Tenant: {{ tenantCode }} ({{ tenantName }})</p>
          <UBadge color="info" variant="soft" size="md" class="font-semibold">Asset Access: {{ assetAccessLabel }}</UBadge>
          <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" :disabled="!canManageSettings" @click="openTenantEdit" />
        </div>
      </div>
      <div class="flex flex-1 flex-wrap items-start justify-end gap-3">
        <div class="flex w-full max-w-[260px] flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Merchant</label>
          <select
            v-model="selectedMerchantId"
            :disabled="isScopedRole && merchants.length <= 1"
            class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
          >
            <option v-if="!isScopedRole" value="">All merchants</option>
            <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>

        <div class="flex w-full max-w-[260px] flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Branch</label>
          <select
            v-model="selectedBranchId"
            :disabled="isScopedRole && filterBranchOptions.length <= 1"
            class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
          >
            <option v-if="!isScopedRole" value="">All branches</option>
            <option v-for="item in filterBranchOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>

        <div class="flex w-full max-w-[220px] flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Asset Type</label>
          <select
            v-model="selectedAssetType"
            class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">All types</option>
            <option v-for="kind in assetTypes" :key="kind" :value="kind">{{ kind }}</option>
          </select>
        </div>
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      :title="error.message || 'Failed to load tenant data'"
    />

    <div class="grid gap-3 lg:grid-cols-6">
      <div class="contents">
        <UCard class="lg:col-span-3 lg:order-1" :ui="{ root: 'h-[240px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Merchant List</p>
            <div class="flex items-center gap-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ merchantRows.length }} items</p>
              <UButton icon="i-lucide-plus" color="primary" variant="soft" size="xs" class="text-white" :disabled="!canManageMerchant" @click="openCreateMerchant" />
            </div>
          </div>
          <div v-if="merchantDeleteError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {{ merchantDeleteError }}
          </div>
          <div v-if="pending" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          <div v-else-if="!merchantRows.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No merchant found.</div>
          <div v-else class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <UTable :data="merchantRows" :columns="merchantColumns" sticky="header" class="tenant-utable h-full overflow-auto min-w-full text-sm">
              <template #code-cell="{ row }">
                <span class="truncate font-medium">{{ row.original.code }}</span>
              </template>
              <template #name-cell="{ row }">
                <span class="truncate font-medium">{{ row.original.name }}</span>
              </template>
              <template #status-cell="{ row }">
                <span class="text-sm font-semibold" :class="statusTextClass(row.original.status)">{{ row.original.status }}</span>
              </template>
              <template #actions-cell="{ row }">
                <div class="flex items-center justify-center gap-1">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" :disabled="!canManageMerchant" @click="openMerchantEdit(row.original)" />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="xs"
                    :loading="merchantDeleteSavingId === row.original.id"
                    :disabled="!canManageMerchant || !row.original.canDelete"
                    :title="row.original.canDelete ? 'Delete' : 'Cannot delete: order history exists'"
                    @click="askDeleteMerchant(row.original)"
                  />
                </div>
              </template>
            </UTable>
          </div>
        </UCard>

        <UCard class="lg:col-span-3 lg:order-3" :ui="{ root: 'h-[240px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Device List</p>
            <div class="flex items-center gap-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ devices.length }} items</p>
              <UButton icon="i-lucide-plus" color="primary" variant="soft" size="xs" class="text-white" :disabled="!canManageAsset" @click="openCreateDevice" />
            </div>
          </div>
          <div v-if="deviceDeleteError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {{ deviceDeleteError }}
          </div>
          <div v-if="pending" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          <div v-else-if="!devices.length" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No devices.</div>
          <div v-else class="flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <UTable :data="devices" :columns="deviceColumns" sticky="header" class="tenant-utable h-full overflow-auto min-w-full text-sm">
              <template #name-cell="{ row }">{{ row.original.name || '-' }}</template>
              <template #deviceUid-cell="{ row }">{{ row.original.deviceUid || '-' }}</template>
              <template #fwVersion-cell="{ row }">{{ row.original.fwVersion || '-' }}</template>
              <template #status-cell="{ row }"><span class="text-sm font-semibold" :class="statusTextClass(row.original.status)">{{ row.original.status }}</span></template>
              <template #actions-cell="{ row }">
                <div class="text-center">
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="xs"
                    :loading="deviceDeleteSavingId === row.original.id"
                    :disabled="!canManageAsset || !row.original.canDelete"
                    :title="row.original.canDelete ? 'Delete' : 'Only SPARE and never-bound device can be deleted'"
                    @click="deleteDevice(row.original)"
                  />
                </div>
              </template>
            </UTable>
          </div>
        </UCard>

      </div>

      <div class="contents">
        <UCard class="lg:col-span-3 lg:order-2" :ui="{ root: 'h-[240px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Branch List</p>
            <div class="flex items-center gap-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ branchRows.length }} items</p>
              <UButton icon="i-lucide-plus" color="primary" variant="soft" size="xs" class="text-white" :disabled="!canManageBranch" @click="openCreateBranch" />
            </div>
          </div>
          <div v-if="branchDeleteError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {{ branchDeleteError }}
          </div>
          <div v-if="pending" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          <div v-else-if="!branchRows.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No branch found.</div>
          <div v-else class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <UTable :data="branchRows" :columns="branchColumns" sticky="header" class="tenant-utable h-full overflow-auto min-w-full text-sm">
              <template #code-cell="{ row }">
                <span class="truncate font-medium">{{ row.original.code }}</span>
              </template>
              <template #name-cell="{ row }">
                <span class="truncate font-medium">{{ row.original.name }}</span>
              </template>
              <template #status-cell="{ row }">
                <span class="text-sm font-semibold" :class="statusTextClass(row.original.status)">{{ row.original.status }}</span>
              </template>
              <template #actions-cell="{ row }">
                <div class="flex items-center justify-center gap-1">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" :disabled="!canManageBranch" @click="openBranchEdit(row.original)" />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="xs"
                    :loading="branchDeleteSavingId === row.original.id"
                    :disabled="!canManageBranch || !row.original.canDelete"
                    :title="row.original.canDelete ? 'Delete' : 'Cannot delete: order history exists'"
                    @click="askDeleteBranch(row.original)"
                  />
                </div>
              </template>
            </UTable>
          </div>
        </UCard>

        <UCard class="lg:col-span-3 lg:order-4" :ui="{ root: 'h-[240px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Machine List</p>
            <div class="flex items-center gap-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ machines.length }} items</p>
              <UButton icon="i-lucide-plus" color="primary" variant="soft" size="xs" class="text-white" :disabled="!canManageAsset" @click="openCreateMachine" />
            </div>
          </div>
          <div v-if="machineDeleteError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {{ machineDeleteError }}
          </div>
          <div v-if="pending" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          <div v-else-if="!machines.length" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No machines.</div>
          <div v-else class="flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <UTable :data="machineRows" :columns="machineColumns" sticky="header" class="tenant-utable h-full overflow-auto min-w-full text-sm">
              <template #status-cell="{ row }"><span class="text-sm font-semibold" :class="statusTextClass(row.original.status)">{{ row.original.status }}</span></template>
              <template #actions-cell="{ row }">
                <div class="text-center">
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="xs"
                    :loading="machineDeleteSavingId === row.original.id"
                    :disabled="!canManageAsset || !row.original.canDelete"
                    :title="row.original.canDelete ? 'Delete' : 'Only SPARE and never-bound machine can be deleted'"
                    @click="deleteMachine(row.original)"
                  />
                </div>
              </template>
            </UTable>
          </div>
        </UCard>

        <UCard class="lg:col-span-3 lg:order-5" :ui="{ root: 'h-[240px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Product List</p>
            <div class="flex items-center gap-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ products.length }} items</p>
              <UButton icon="i-lucide-plus" color="primary" variant="soft" size="xs" class="text-white" :disabled="!canManageAsset" @click="openCreateProduct" />
            </div>
          </div>
          <div v-if="pending" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          <div v-else-if="!products.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No products.</div>
          <div v-else class="flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <UTable :data="productRows" :columns="productColumns" sticky="header" class="tenant-utable h-full overflow-auto min-w-full text-sm">
              <template #name-cell="{ row }"><span class="font-medium">{{ row.original.name }}</span></template>
              <template #serviceLabel-cell="{ row }"><div>{{ row.original.serviceLabel }}</div></template>
              <template #statusLabel-cell="{ row }"><span class="text-sm font-semibold" :class="statusTextClass(row.original.statusLabel)">{{ row.original.statusLabel }}</span></template>
              <template #lockLabel-cell="{ row }">
                <UBadge v-if="row.original.locked" color="warning" variant="soft" size="xs">LOCKED</UBadge>
                <span v-else class="text-sm text-slate-400 dark:text-slate-500">-</span>
              </template>
              <template #actions-cell="{ row }">
                <div class="text-center">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" :disabled="!canManageAsset || row.original.locked" @click="openEditProduct(row.original)" />
                </div>
              </template>
            </UTable>
          </div>
        </UCard>

      </div>
    </div>

    <div class="space-y-3">
      <UCard :ui="{ root: 'h-[280px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Biller Profiles</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ governanceBillers.length }} items</p>
        </div>
        <div v-if="governanceBillerError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{{ governanceBillerError }}</div>
        <div v-if="governancePending" class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
        <div v-else class="flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <UTable :data="governanceBillerRows" :columns="billerColumns" sticky="header" class="tenant-utable h-full overflow-auto min-w-full text-sm">
            <template #priority-header>
              <div class="w-full text-center">Priority</div>
            </template>
            <template #merchantBindingCount-header>
              <div class="w-full text-center">Merchant Binding</div>
            </template>
            <template #branchBindingCount-header>
              <div class="w-full text-center">Branch Binding</div>
            </template>
            <template #billerIdMasked-cell="{ row }">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-slate-700 dark:text-slate-200">#{{ row.original.billerIdMasked }}</span>
                <UButton
                  :icon="billerIdVisibleMap[row.original.id] ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="!canManageSettings"
                  @click="toggleBillerIdVisibility(row.original.id)"
                />
              </div>
            </template>
            <template #priority-cell="{ row }"><div class="text-center text-sm text-slate-700 dark:text-slate-200">{{ row.original.priority }}</div></template>
            <template #status-cell="{ row }"><span class="text-sm font-semibold" :class="statusTextClass(row.original.status)">{{ row.original.status }}</span></template>
            <template #merchantBindingCount-cell="{ row }"><div class="text-center text-sm text-slate-700 dark:text-slate-200">{{ row.original.merchantBindingCount }}</div></template>
            <template #branchBindingCount-cell="{ row }"><div class="text-center text-sm text-slate-700 dark:text-slate-200">{{ row.original.branchBindingCount }}</div></template>
          </UTable>
        </div>
      </UCard>

    </div>

    <UModal v-model:open="tenantEditOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Edit Tenant Name</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeTenantEdit" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="tenantEditError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="tenantEditError" />
            <UFormField>
              <template #label>
                <span>Tenant Name <span class="text-rose-500">*</span></span>
              </template>
              <UInput v-model="tenantEditName" placeholder="Enter tenant name" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeTenantEdit">Cancel</UButton>
              <UButton color="primary" :loading="tenantEditSaving" :disabled="!canManageSettings" @click="saveTenantName">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="merchantCreateOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Merchant</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateMerchant" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="merchantCreateError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="merchantCreateError" />
            <UFormField>
              <template #label>
                <span>Merchant Name <span class="text-rose-500">*</span></span>
              </template>
              <UInput
                v-model="merchantCreateName"
                placeholder="Enter merchant name"
                class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
              />
            </UFormField>
            <UFormField>
              <template #label>
                <span>Status <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="merchantCreateStatus"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreateMerchant">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="merchantCreateSaving" :disabled="!canManageMerchant" @click="submitCreateMerchant">Create Merchant</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="merchantEditOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Edit Merchant</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeMerchantEdit" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="merchantEditError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="merchantEditError" />
            <UFormField><template #label><span>Merchant Name <span class="text-rose-500">*</span></span></template><UInput v-model="merchantEditName" /></UFormField>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Status">
                <select v-model="merchantEditStatus" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </UFormField>
              <UFormField label="Environment">
                <select v-model="merchantEditEnvironment" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                  <option value="TEST">TEST</option>
                  <option value="LIVE">LIVE</option>
                </select>
              </UFormField>
            </div>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeMerchantEdit">Cancel</UButton>
              <UButton color="primary" :loading="merchantEditSaving" :disabled="!canManageMerchant" @click="submitMerchantEdit">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="branchCreateOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Branch</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateBranch" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="branchCreateError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="branchCreateError" />
            <UFormField>
              <template #label>
                <span>Branch Name <span class="text-rose-500">*</span></span>
              </template>
              <UInput
                v-model="branchCreateName"
                placeholder="Enter branch name"
                class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
              />
            </UFormField>
            <UFormField label="Merchant (optional)">
              <select
                v-model="branchCreateMerchantId"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
              >
                <option value="">No merchant</option>
                <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>
            </UFormField>
            <UFormField>
              <template #label>
                <span>Status <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="branchCreateStatus"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreateBranch">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="branchCreateSaving" :disabled="!canManageBranch" @click="submitCreateBranch">Create Branch</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="branchEditOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Edit Branch</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeBranchEdit" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="branchEditError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="branchEditError" />
            <UFormField><template #label><span>Branch Name <span class="text-rose-500">*</span></span></template><UInput v-model="branchEditName" /></UFormField>
            <UFormField label="Merchant (optional)">
              <select v-model="branchEditMerchantId" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                <option value="">No merchant</option>
                <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>
            </UFormField>
            <UFormField label="Status">
              <select v-model="branchEditStatus" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeBranchEdit">Cancel</UButton>
              <UButton color="primary" :loading="branchEditSaving" :disabled="!canManageBranch" @click="submitBranchEdit">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deleteConfirmOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Confirm Delete</h3>
          </template>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            Delete {{ deleteConfirmType }} <span class="font-semibold">{{ deleteConfirmName }}</span>?
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeDeleteConfirm">Cancel</UButton>
              <UButton color="error" :loading="deleteConfirmSaving" :disabled="(deleteConfirmType === 'merchant' && !canManageMerchant) || (deleteConfirmType === 'branch' && !canManageBranch)" @click="submitDeleteConfirm">Delete</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="deviceCreateOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Device</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateDevice" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="deviceCreateError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="deviceCreateError" />
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label>
                  <span>MAC Address <span class="text-rose-500">*</span></span>
                </template>
                <UInput
                  v-model="deviceCreateMacAddress"
                  placeholder="e.g. 3C:33:54:AA:BB:CC"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
              <UFormField>
                <template #label>
                  <span>Device UID <span class="text-rose-500">*</span></span>
                </template>
                <UInput
                  :model-value="deviceCreateDeviceUid"
                  readonly
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-slate-100 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label>
                  <span>FW Version <span class="text-rose-500">*</span></span>
                </template>
                <UInput
                  v-model="deviceCreateFwVersion"
                  placeholder="e.g. 1.0.0"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
              <UFormField label="Device Name (optional)">
                <UInput
                  v-model="deviceCreateName"
                  placeholder="e.g. IOT-WASH-01"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
            </div>
            <UFormField label="Device Model (optional)">
              <UInput
                v-model="deviceCreateModel"
                placeholder="e.g. ESP32-D1Mini"
                class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
              />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreateDevice">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="deviceCreateSaving" :disabled="!canManageAsset" @click="submitCreateDevice">Create Device</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="machineCreateOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Machine</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateMachine" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="machineCreateError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="machineCreateError" />
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label>
                  <span>Serial No <span class="text-rose-500">*</span></span>
                </template>
                <UInput
                  v-model="machineCreateSerialNo"
                  placeholder="e.g. SN-02621165"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
              <UFormField label="Brand (optional)">
                <UInput
                  v-model="machineCreateBrand"
                  placeholder="e.g. SpeedQueen"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
            </div>
            <UFormField label="Model (optional)">
              <UInput
                v-model="machineCreateModel"
                placeholder="e.g. WM-001"
                class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
              />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreateMachine">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="machineCreateSaving" :disabled="!canManageAsset" @click="submitCreateMachine">Create Machine</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="productCreateOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ isProductEditMode ? 'Edit Product' : 'Create Product' }}</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateProduct" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="productCreateError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="productCreateError" />
            <UAlert
              v-if="isProductEditMode && isEditingProductLocked"
              color="warning"
              variant="soft"
              icon="i-lucide-lock"
              title="This product is locked because completed orders reference it."
            />
            <UFormField>
              <template #label>
                <span>Product Name <span class="text-rose-500">*</span></span>
              </template>
              <UInput
                v-model="productCreateName"
                placeholder="Enter product name"
                class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                :ui="{ base: 'h-10 bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
              />
            </UFormField>

            <UFormField>
              <template #label>
                <span>Product Type <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="productCreateKind"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select type</option>
                <option v-for="kind in productTypeOptions" :key="kind.value" :value="kind.value">
                  {{ kind.label }} ({{ kind.value }})
                </option>
              </select>
            </UFormField>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label>
                  <span>Price (THB) <span class="text-rose-500">*</span></span>
                </template>
                <UInput
                  v-model.number="productCreateAmount"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 30"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'h-10 bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>

              <UFormField>
                <template #label>
                  <span>Service Mode <span class="text-rose-500">*</span></span>
                </template>
                <select
                  v-model="productCreateServiceMode"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option v-for="option in serviceModeOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </UFormField>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField>
                <template #label>
                  <span>Service Unit <span class="text-rose-500">*</span></span>
                </template>
                <select
                  v-model="productCreateServiceUnit"
                  class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option v-for="option in serviceUnitOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </UFormField>

              <UFormField>
                <template #label>
                  <span>Service Quantity <span class="text-rose-500">*</span></span>
                </template>
                <UInput
                  v-model.number="productCreateQuantity"
                  type="number"
                  min="1"
                  step="0.001"
                  placeholder="e.g. 60 / 200 / 1"
                  class="text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                  :ui="{ base: 'h-10 bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                />
              </UFormField>
            </div>

            <UFormField>
              <template #label>
                <span>Status <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="productCreateStatus"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeCreateProduct">Cancel</UButton>
              <UButton color="primary" class="text-white" :loading="productCreateSaving" :disabled="!canManageAsset || (isProductEditMode && isEditingProductLocked)" @click="submitCreateProduct">{{ isProductEditMode ? 'Save Product' : 'Create Product' }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="bindProductOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Bind Product to Asset</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeBindProduct" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="bindProductError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="bindProductError" />
            <UFormField>
              <template #label>
                <span>Product <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="bindProductId"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select product</option>
                <option v-for="item in bindableProducts" :key="item.id" :value="item.id">
                  {{ item.name }} · {{ productServiceText(item) }}
                </option>
              </select>
            </UFormField>
            <p v-if="!bindableProducts.length" class="text-xs text-slate-500 dark:text-slate-400">
              No available active products for this asset type.
            </p>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeBindProduct">Cancel</UButton>
              <UButton color="primary" :loading="bindProductSaving" :disabled="!canManageAsset || !bindProductId" @click="submitBindProduct">Bind Product</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="bindDeviceOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ activeBinding?.iotDevice ? 'Replace IoT Device' : 'Bind IoT Device' }}</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeBindDeviceModal" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="bindDeviceError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="bindDeviceError" />
            <UFormField>
              <template #label>
                <span>Select Spare IoT Device <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="bindDeviceId"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select IoT device</option>
                <option v-for="item in availableIotDevices" :key="item.id" :value="item.id">
                  {{ item.name || item.deviceUid || item.macAddress }} · {{ item.macAddress }}
                </option>
              </select>
            </UFormField>
            <p v-if="!availableIotDevices.length" class="text-xs text-slate-500 dark:text-slate-400">No spare IoT devices available.</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeBindDeviceModal">Cancel</UButton>
              <UButton color="primary" :loading="bindDeviceSaving" :disabled="!canManageAsset || !bindDeviceId" @click="submitBindDevice">{{ activeBinding?.iotDevice ? 'Replace' : 'Bind' }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="bindMachineOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ activeBinding?.machine ? 'Replace Machine' : 'Bind Machine' }}</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeBindMachineModal" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="bindMachineError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="bindMachineError" />
            <UFormField>
              <template #label>
                <span>Select Spare Machine <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="bindMachineId"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select machine</option>
                <option v-for="item in availableMachines" :key="item.id" :value="item.id">
                  {{ item.serialNo }}{{ item.brand || item.model ? ` · ${item.brand || '-'} / ${item.model || '-'}` : '' }}
                </option>
              </select>
            </UFormField>
            <p v-if="!availableMachines.length" class="text-xs text-slate-500 dark:text-slate-400">No spare machines available.</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeBindMachineModal">Cancel</UButton>
              <UButton color="primary" :loading="bindMachineSaving" :disabled="!canManageAsset || !bindMachineId" @click="submitBindMachine">{{ activeBinding?.machine ? 'Replace' : 'Bind' }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
:deep(.tenant-utable thead) {
  background-color: rgb(30 41 59) !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 30 !important;
}

:deep(.tenant-utable thead th) {
  color: rgb(203 213 225) !important;
  padding-top: 0.3rem !important;
  padding-bottom: 0.3rem !important;
}

.dark :deep(.tenant-utable thead) {
  background-color: rgb(15 23 42) !important;
}

.dark :deep(.tenant-utable thead th) {
  color: rgb(226 232 240) !important;
}

:deep(.tenant-utable tbody td) {
  padding-top: 0.3rem !important;
  padding-bottom: 0.3rem !important;
}
</style>
