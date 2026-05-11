<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'
import IotBindingModal from '~/components/asset/IotBindingModal.vue'
import MachineBindingModal from '~/components/asset/MachineBindingModal.vue'

definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})

type AssetWorkspaceResponse = {
  tenant?: { id: string; code: string; name: string } | null
  selectedMerchantId: string
  selectedBranchId: string
  selectedAssetId: string
  selectedAssetType: string
  assetTypes: string[]
  merchants: Array<{ id: string; code: string; name: string }>
  branches: Array<{ id: string; code: string; name: string; merchantAccountId: string | null }>
  assets: Array<{
    id: string
    code: string
    name: string
    status: string
    readiness?: 'READY' | 'MISSING_DEVICE' | 'MISSING_MACHINE' | 'MISSING_PRODUCT'
    kind: string
    branchId: string
    updatedAt: string
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
  }>
  selectedAsset?: {
    id: string
    code: string
    name: string
    kind: string
    status: string
    prices: Array<{
      id: string
      amount: number
      durationMinutes: number
      serviceMode?: string
      serviceUnit?: string
      quantity?: number | null
      active: boolean
      orderCount: number
      canUnbind: boolean
      currentOffer?: {
        id: string
        pricingType: string
        amount: number
        effectiveFrom: string
        effectiveTo?: string | null
        priority: number
        reason?: string | null
      } | null
      upcomingOffer?: {
        id: string
        pricingType: string
        amount: number
        effectiveFrom: string
        effectiveTo?: string | null
        priority: number
        reason?: string | null
      } | null
      pausedOffer?: {
        id: string
        pricingType: string
        amount: number
        effectiveFrom: string
        effectiveTo?: string | null
        priority: number
        reason?: string | null
      } | null
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
    iotDevice: {
      id: string
      deviceUid: string | null
      macAddress: string
      name: string | null
      model: string | null
      fwVersion: string | null
      status: string
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

const selectedMerchantId = ref('')
const selectedBranchId = ref('')
const selectedAssetId = ref('')
const selectedAssetType = ref('')
const assetPage = ref(1)
const assetPageSize = 20

const bindProductOpen = ref(false)
const bindProductSaving = ref(false)
const bindProductError = ref('')
const bindProductId = ref('')
const unbindProductSavingId = ref('')
const unbindProductError = ref('')
const promotionOpen = ref(false)
const promotionSaving = ref(false)
const promotionError = ref('')
const promotionTargetProductId = ref('')
const promotionAmount = ref<number | null>(null)
const promotionStartDate = ref<CalendarDate | null>(null)
const promotionStartTime = ref('00:00')
const promotionEndDate = ref<CalendarDate | null>(null)
const promotionEndTime = ref('00:00')
const promotionStartCalendarOpen = ref(false)
const promotionEndCalendarOpen = ref(false)
const promotionReplaceActive = ref(false)
const promotionPriority = ref(100)

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
const staticQrOpen = ref(false)
const staticQrLoading = ref(false)
const staticQrError = ref('')
const staticQrCopyDone = ref(false)
const staticQrData = ref<{
  mode: string
  qrText: string
  amount: number
  asset: { id: string; code: string; name: string }
  branch: { id: string | null; code: string | null; name: string | null }
  merchant: { id: string | null; code: string | null; name: string | null }
  product: { id: string; code: string; name: string; baseAmount: number }
  currentOffer: { id: string; pricingType: string; amount: number; priority: number; effectiveFrom: string; effectiveTo?: string | null } | null
  biller: {
    source: string
    providerCode: string | null
    integrationMode: string
    qrPaymentMode: string | null
    billerId: string | null
    shopId: string | null
    accountName: string | null
    bankName: string | null
    accountNumber: string | null
    promptPayTarget: string | null
  } | null
  qrFields: {
    reference: string
    tenantId: string
    branchCode: string | null
    assetCode: string
    productCode: string
  }
} | null>(null)
const offerTab = ref<'current' | 'upcoming' | 'history'>('current')
const selectedOfferProductId = ref('')
const selectedOfferProductName = ref('')
const offerSectionRef = ref<HTMLElement | null>(null)
const offerBuckets = ref<{
  current: Array<{
    id: string
    pricingType: string
    amount: number
    priority: number
    effectiveFrom: string
    effectiveTo?: string | null
    updatedAt?: string
    active: boolean
    reason?: string | null
    product?: { id: string; name: string; code: string } | null
  }>
  upcoming: Array<{
    id: string
    pricingType: string
    amount: number
    priority: number
    effectiveFrom: string
    effectiveTo?: string | null
    updatedAt?: string
    active: boolean
    reason?: string | null
    product?: { id: string; name: string; code: string } | null
  }>
  history: Array<{
    id: string
    pricingType: string
    amount: number
    priority: number
    effectiveFrom: string
    effectiveTo?: string | null
    updatedAt?: string
    active: boolean
    reason?: string | null
    product?: { id: string; name: string; code: string } | null
  }>
}>({
  current: [],
  upcoming: [],
  history: []
})
const offerRows = computed<Array<{
  id: string
  pricingType: string
  amount: number
  priority: number
  effectiveFrom: string
  effectiveTo?: string | null
  updatedAt?: string
  active: boolean
  reason?: string | null
  product?: { id: string; name: string; code: string } | null
}>>(() => {
  const rows = offerTab.value === 'current'
    ? offerBuckets.value.current
    : offerTab.value === 'upcoming'
      ? offerBuckets.value.upcoming
      : offerBuckets.value.history
  if (!selectedOfferProductId.value && !selectedOfferProductName.value) return rows
  const nameKey = selectedOfferProductName.value.trim().toLowerCase()
  return rows.filter((item) => {
    if (selectedOfferProductId.value && item.product?.id === selectedOfferProductId.value) return true
    if (nameKey && String(item.product?.name || '').trim().toLowerCase() === nameKey) return true
    return false
  })
})
const productOfferStateMap = computed(() => {
  const map = new Map<string, { state: 'current' | 'upcoming' | 'history'; amount?: number; from?: string; to?: string | null }>()
  for (const item of offerBuckets.value.current) {
    if (!item.product?.id) continue
    map.set(item.product.id, { state: 'current', amount: item.amount, from: item.effectiveFrom, to: item.effectiveTo })
  }
  for (const item of offerBuckets.value.upcoming) {
    if (!item.product?.id) continue
    if (!map.has(item.product.id)) {
      map.set(item.product.id, { state: 'upcoming', amount: item.amount, from: item.effectiveFrom, to: item.effectiveTo })
    }
  }
  // history is intentionally not used for price replacement display
  // so base price won't look like currently promoted price
  return map
})
const historyOfferProductIds = computed(() => {
  const ids = new Set<string>()
  for (const item of offerBuckets.value.history) {
    if (item.product?.id) ids.add(item.product.id)
  }
  return ids
})
const pausedOfferByProductId = computed(() => {
  const now = new Date()
  const map = new Map<string, {
    id: string
    pricingType: string
    amount: number
    priority: number
    effectiveFrom: string
    effectiveTo?: string | null
    updatedAt?: string
    active: boolean
    reason?: string | null
    product?: { id: string; name: string; code: string } | null
  }>()
  for (const item of offerBuckets.value.history) {
    const productId = item.product?.id
    if (!productId) continue
    const isPaused = String(item.reason || '').toLowerCase().includes('pause')
    const notExpired = !item.effectiveTo || new Date(item.effectiveTo) >= now
    if (!isPaused || !notExpired) continue
    if (!map.has(productId)) map.set(productId, item)
  }
  return map
})

function openOfferDetails(productId?: string | null) {
  if (!productId) return
  selectedOfferProductId.value = productId
  selectedOfferProductName.value = assetPriceRows.value.find(r => r.product?.id === productId)?.productName || ''
  const state = productOfferStateMap.value.get(productId)?.state
  if (state) {
    offerTab.value = state
  } else if (historyOfferProductIds.value.has(productId)) {
    offerTab.value = 'history'
  }
  nextTick(() => {
    offerSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function openOfferHistorySection() {
  offerTab.value = 'history'
  nextTick(() => {
    offerSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
const offerLoading = ref(false)
const offerError = ref('')
const confirmDisablePromoOpen = ref(false)
const confirmDisablePromoId = ref('')
const confirmDisablePromoLabel = ref('')
const confirmPromotionAction = ref<'pause' | 'resume' | 'delete'>('pause')
const { data: authData } = useAuth()

type AppPermission = 'portal.asset.read' | 'portal.asset.manage.global' | 'portal.asset.manage.scoped'
const rolePermissionMap: Record<string, AppPermission[]> = {
  OWNER: ['portal.asset.read', 'portal.asset.manage.global', 'portal.asset.manage.scoped'],
  MANAGER: ['portal.asset.read', 'portal.asset.manage.scoped'],
  STAFF: ['portal.asset.read', 'portal.asset.manage.scoped']
}
const roleKey = computed(() => String(authData.value?.user?.role || '').toUpperCase())
const isScopedRole = computed(() => roleKey.value === 'MANAGER' || roleKey.value === 'STAFF')
const canManageAssetGlobal = computed(() => (rolePermissionMap[roleKey.value] || []).includes('portal.asset.manage.global'))
const canManageAssetScoped = computed(() => (rolePermissionMap[roleKey.value] || []).includes('portal.asset.manage.scoped'))
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

const { data, pending, error, refresh } = await useFetch<AssetWorkspaceResponse>('/api/app/tenant', {
  query: queryParams
})

const merchants = computed(() => data.value?.merchants || [])
const branches = computed(() => data.value?.branches || [])
const filterBranchOptions = computed(() => {
  if (!selectedMerchantId.value) return branches.value
  return branches.value.filter(item => item.merchantAccountId === selectedMerchantId.value)
})
const assets = computed(() => data.value?.assets || [])
const assetTotalPages = computed(() => Math.max(1, Math.ceil(assets.value.length / assetPageSize)))
const pagedAssets = computed(() => {
  const start = (assetPage.value - 1) * assetPageSize
  return assets.value.slice(start, start + assetPageSize)
})
const assetStartIndex = computed(() => {
  if (!assets.value.length) return 0
  return (assetPage.value - 1) * assetPageSize + 1
})
const assetEndIndex = computed(() => {
  if (!assets.value.length) return 0
  return Math.min(assetPage.value * assetPageSize, assets.value.length)
})
const products = computed(() => data.value?.products || [])
const assetTypes = computed(() => data.value?.assetTypes || [])
const selectedAsset = computed(() => data.value?.selectedAsset || null)
const activeBinding = computed(() => data.value?.activeBinding || null)
const selectedTenantName = computed(() => data.value?.tenant?.name || '-')
const selectedAssetBranchId = computed(() => {
  const id = selectedAsset.value?.id
  if (!id) return ''
  return assets.value.find(item => item.id === id)?.branchId || ''
})
const selectedBranchName = computed(() => {
  const branchId = selectedAssetBranchId.value
  if (!branchId) return '-'
  return branches.value.find(item => item.id === branchId)?.name || '-'
})
const selectedMerchantName = computed(() => {
  const branchId = selectedAssetBranchId.value
  if (!branchId) return '-'
  const merchantId = branches.value.find(item => item.id === branchId)?.merchantAccountId || ''
  if (!merchantId) return '-'
  return merchants.value.find(item => item.id === merchantId)?.name || '-'
})
const assetColumns = [
  { accessorKey: 'no', header: '#' },
  { accessorKey: 'name', header: 'Name / Code' },
  { accessorKey: 'kind', header: 'Type' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'updatedAt', header: 'Updated' }
]
const assetPriceColumns = [
  { accessorKey: 'productName', header: 'Product' },
  { accessorKey: 'serviceLabel', header: 'Service' },
  { accessorKey: 'serviceModeLabel', header: 'Service Mode' },
  { accessorKey: 'serviceUnitLabel', header: 'Service Unit' },
  { accessorKey: 'promotionLabel', header: 'Price / Promo' },
  { accessorKey: 'priceUnitLabel', header: 'Currency' },
  { accessorKey: 'orderCount', header: 'Orders' },
  { accessorKey: 'bindingLabel', header: 'Binding' },
  { accessorKey: 'productStatusLabel', header: 'Product' },
  { accessorKey: 'actions', header: 'Action' }
]

function serviceUnitLabel(unit?: string | null) {
  const normalized = String(unit || '').toUpperCase()
  if (normalized === 'MINUTE') return 'min'
  if (normalized === 'GRAM') return 'g'
  if (normalized === 'LITER') return 'L'
  if (normalized === 'PIECE') return 'piece'
  if (normalized === 'SLOT') return 'slot'
  return 'unit'
}

function serviceModeLabel(mode?: string | null) {
  const normalized = String(mode || '').toUpperCase()
  if (!normalized) return '-'
  return normalized
}

function resolvePriceUnit() {
  return 'THB'
}

function productServiceText(item: { durationMinutes?: number | null; quantity?: number | null; serviceMode?: string | null; serviceUnit?: string | null }) {
  const qty = item.quantity ?? item.durationMinutes ?? null
  return `${qty ?? '-'}`
}

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
const assetPriceRows = computed(() => {
  return (selectedAsset.value?.prices || []).map((price) => {
    const pausedOfferFallback = price.product?.id ? (pausedOfferByProductId.value.get(price.product.id) || null) : null
    return {
      ...price,
      productName: price.product?.name || '-',
      serviceLabel: productServiceText({
        durationMinutes: price.product?.durationMinutes ?? price.durationMinutes,
        quantity: price.product?.quantity ?? price.quantity ?? null,
        serviceMode: price.product?.serviceMode ?? price.serviceMode ?? null,
        serviceUnit: price.product?.serviceUnit ?? price.serviceUnit ?? null
      }),
      priceUnitLabel: resolvePriceUnit(),
      serviceModeLabel: serviceModeLabel(price.product?.serviceMode ?? price.serviceMode ?? null),
      serviceUnitLabel: serviceUnitLabel(price.product?.serviceUnit ?? price.serviceUnit ?? null),
      bindingLabel: price.active ? 'BOUND' : 'INACTIVE',
      productStatusLabel: price.product?.active ? 'ACTIVE' : 'DISABLED',
      pausedOffer: price.pausedOffer || pausedOfferFallback,
      promotionLabel: price.currentOffer ? `Promo ${price.currentOffer.amount} THB` : '-'
    }
  })
})

watch(() => data.value?.selectedMerchantId, (v) => {
  if (v && !selectedMerchantId.value) selectedMerchantId.value = v
}, { immediate: true })

watch(() => data.value?.selectedAssetType, (v) => {
  if (v && !selectedAssetType.value) selectedAssetType.value = v
}, { immediate: true })

watch(() => data.value?.selectedBranchId, (v) => {
  if (v && !selectedBranchId.value) selectedBranchId.value = v
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

watch(assets, (rows) => {
  if (selectedAssetId.value && !rows.some(item => item.id === selectedAssetId.value)) {
    selectedAssetId.value = ''
  }
  if (assetPage.value > assetTotalPages.value) {
    assetPage.value = assetTotalPages.value
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

watch([selectedMerchantId, selectedBranchId, selectedAssetType], () => {
  assetPage.value = 1
})

function statusTextClass(status?: string | null) {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'VERIFIED' || s === 'BOUND') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'SUSPENDED' || s === 'MAINTENANCE' || s === 'SPARE') return 'text-amber-600 dark:text-amber-400'
  if (s === 'DISABLED' || s === 'INACTIVE' || s === 'OFFLINE') return 'text-rose-600 dark:text-rose-400'
  return 'text-slate-700 dark:text-slate-200'
}

function readinessLabel(readiness?: string | null) {
  const r = String(readiness || '').toUpperCase()
  if (r === 'MISSING_DEVICE') return 'Missing device'
  if (r === 'MISSING_MACHINE') return 'Missing machine'
  if (r === 'MISSING_PRODUCT') return 'Missing product'
  return 'Ready'
}

function readinessTextClass(readiness?: string | null) {
  const r = String(readiness || '').toUpperCase()
  if (r === 'READY') return 'text-emerald-600 dark:text-emerald-400'
  if (r === 'MISSING_DEVICE' || r === 'MISSING_MACHINE') return 'text-amber-600 dark:text-amber-400'
  if (r === 'MISSING_PRODUCT') return 'text-rose-600 dark:text-rose-400'
  return 'text-slate-700 dark:text-slate-200'
}

const selectedAssetReadiness = computed(() => {
  const asset = selectedAsset.value
  if (!asset) return 'MISSING_DEVICE'
  const hasDevice = Boolean(activeBinding.value?.iotDevice?.id)
  const hasMachine = Boolean(activeBinding.value?.machine?.id)
  const hasProduct = (asset.prices || []).some(item => item.active)
  if (!hasDevice) return 'MISSING_DEVICE'
  if (!hasMachine) return 'MISSING_MACHINE'
  if (!hasProduct) return 'MISSING_PRODUCT'
  return 'READY'
})

function nextAssetPage() {
  if (assetPage.value < assetTotalPages.value) assetPage.value += 1
}

function prevAssetPage() {
  if (assetPage.value > 1) assetPage.value -= 1
}

function fmtDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

function fmtTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString()
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

function openAssetProductBinding() {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value) return
  bindProductError.value = ''
  bindProductId.value = bindableProducts.value[0]?.id || ''
  bindProductOpen.value = true
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

function openPromotionModal(priceRow: { product?: { id: string } | null; amount: number }) {
  if (!canManageAsset.value) return
  if (!selectedAssetId.value || !priceRow.product?.id) return
  promotionTargetProductId.value = priceRow.product.id
  promotionAmount.value = Number(priceRow.amount || 0)
  const now = new Date()
  const plus1 = new Date(now)
  promotionStartDate.value = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
  promotionEndDate.value = new CalendarDate(plus1.getFullYear(), plus1.getMonth() + 1, plus1.getDate())
  promotionStartTime.value = '00:00'
  promotionEndTime.value = '23:59'
  promotionPriority.value = 100
  promotionError.value = ''
  promotionReplaceActive.value = false
  promotionOpen.value = true
}

function closePromotionModal() {
  promotionOpen.value = false
  promotionSaving.value = false
  promotionError.value = ''
  promotionStartDate.value = null
  promotionEndDate.value = null
  promotionStartCalendarOpen.value = false
  promotionEndCalendarOpen.value = false
  promotionReplaceActive.value = false
  promotionPriority.value = 100
}

function asJsDate(dateValue: CalendarDate | Date | null) {
  if (!dateValue) return null
  if (dateValue instanceof Date) return new Date(dateValue)
  return dateValue.toDate(getLocalTimeZone())
}

function mergeDateAndTime(dateValue: CalendarDate | Date | null, time: string) {
  const date = asJsDate(dateValue)
  if (!date) return null
  const [hour, minute] = String(time || '').split(':').map(v => Number(v || 0))
  const merged = new Date(date)
  merged.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0)
  return merged
}

function fmtInputDate(v: CalendarDate | Date | null) {
  const d = asJsDate(v)
  return d ? d.toLocaleDateString() : 'Select date'
}

async function submitPromotion() {
  if (!canManageAsset.value || !selectedAssetId.value || !promotionTargetProductId.value || !promotionAmount.value) return
  const startDateTime = mergeDateAndTime(promotionStartDate.value, promotionStartTime.value)
  const endDateTime = mergeDateAndTime(promotionEndDate.value, promotionEndTime.value)
  if (!startDateTime) return
  promotionSaving.value = true
  promotionError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/offers`, {
      method: 'POST',
      body: {
        productId: promotionTargetProductId.value,
        amount: Number(promotionAmount.value),
        effectiveFrom: startDateTime.toISOString(),
        effectiveTo: endDateTime ? endDateTime.toISOString() : null,
        priority: Number(promotionPriority.value || 100),
        reason: 'portal-asset-promotion',
        replaceActive: promotionReplaceActive.value
      }
    })
    await refresh()
    await loadOffers()
    closePromotionModal()
  } catch (err) {
    promotionError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error)?.message || 'Failed to create promotion'
  } finally {
    promotionSaving.value = false
  }
}

async function disablePromotion(offerId?: string | null) {
  if (!canManageAsset.value || !selectedAssetId.value || !offerId) return
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/offers/${offerId}/disable`, {
      method: 'POST',
      body: { reason: 'portal-manual-pause' }
    })
    await refresh()
    await loadOffers()
  } catch (err) {
    unbindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error)?.message || 'Failed to disable promotion'
  }
}

async function resumePromotion(offerId?: string | null) {
  if (!canManageAsset.value || !selectedAssetId.value || !offerId) return
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/offers/${offerId}/resume`, { method: 'POST' })
    await refresh()
    await loadOffers()
  } catch (err) {
    unbindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error)?.message || 'Failed to resume promotion'
  }
}

function requestDisablePromotion(offerId?: string | null, label?: string | null, action: 'pause' | 'resume' | 'delete' = 'pause') {
  if (!canManageAsset.value || !offerId) return
  confirmPromotionAction.value = action
  confirmDisablePromoId.value = offerId
  confirmDisablePromoLabel.value = String(label || '').trim() || 'this promotion'
  confirmDisablePromoOpen.value = true
}

async function deletePromotion(offerId?: string | null) {
  if (!canManageAsset.value || !offerId) return
  try {
    await $fetch(`/api/app/promotions/${offerId}`, {
      method: 'DELETE',
      query: { scope: 'asset' }
    })
    await refresh()
    await loadOffers()
  } catch (err) {
    unbindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error)?.message || 'Failed to delete promotion'
  }
}

async function confirmDisablePromotion() {
  const id = confirmDisablePromoId.value
  if (!id) return
  confirmDisablePromoOpen.value = false
  if (confirmPromotionAction.value === 'resume') await resumePromotion(id)
  else if (confirmPromotionAction.value === 'delete') await deletePromotion(id)
  else await disablePromotion(id)
  confirmDisablePromoId.value = ''
  confirmDisablePromoLabel.value = ''
}

function closeStaticQrModal() {
  staticQrOpen.value = false
  staticQrLoading.value = false
  staticQrError.value = ''
  staticQrCopyDone.value = false
}

async function openStaticQrModal(productId?: string | null) {
  if (!canManageAsset.value || !selectedAssetId.value || !productId) return
  staticQrLoading.value = true
  staticQrError.value = ''
  staticQrCopyDone.value = false
  staticQrOpen.value = true
  try {
    const payload = await $fetch<{
      mode: string
      qrText: string
      amount: number
      asset: { id: string; code: string; name: string }
      branch: { id: string | null; code: string | null; name: string | null }
      merchant: { id: string | null; code: string | null; name: string | null }
      product: { id: string; code: string; name: string; baseAmount: number }
      currentOffer: { id: string; pricingType: string; amount: number; priority: number; effectiveFrom: string; effectiveTo?: string | null } | null
      biller: {
        source: string
        providerCode: string | null
        integrationMode: string
        qrPaymentMode: string | null
        billerId: string | null
        shopId: string | null
        accountName: string | null
        bankName: string | null
        accountNumber: string | null
        promptPayTarget: string | null
      } | null
      qrFields: {
        reference: string
        tenantId: string
        branchCode: string | null
        assetCode: string
        productCode: string
      }
    }>(`/api/app/assets/${selectedAssetId.value}/products/${productId}/static-qr`)
    staticQrData.value = payload
  } catch (err) {
    staticQrData.value = null
    staticQrError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error)?.message || 'Failed to build static QR'
  } finally {
    staticQrLoading.value = false
  }
}

async function copyStaticQrText() {
  const text = staticQrData.value?.qrText || ''
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    staticQrCopyDone.value = true
    setTimeout(() => { staticQrCopyDone.value = false }, 1500)
  } catch {
    staticQrError.value = 'Failed to copy QR text'
  }
}

async function loadOffers() {
  if (!selectedAssetId.value) {
    offerBuckets.value = { current: [], upcoming: [], history: [] }
    return
  }
  offerLoading.value = true
  offerError.value = ''
  try {
    const res = await $fetch<{
      current: Array<any>
      upcoming: Array<any>
      history: Array<any>
    }>(`/api/app/assets/${selectedAssetId.value}/offers`)
    offerBuckets.value = {
      current: res.current || [],
      upcoming: res.upcoming || [],
      history: res.history || []
    }
  } catch (err) {
    offerError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error)?.message || 'Failed to load offers'
    offerBuckets.value = { current: [], upcoming: [], history: [] }
  } finally {
    offerLoading.value = false
  }
}

watch([selectedAssetId, offerTab], () => {
  void loadOffers()
}, { immediate: true })

watch(assetPriceRows, (rows) => {
  if (!rows.length) {
    selectedOfferProductId.value = ''
    selectedOfferProductName.value = ''
    return
  }
  const exists = rows.some(r => r.product?.id === selectedOfferProductId.value)
  if (!exists) {
    selectedOfferProductId.value = rows[0]?.product?.id || ''
    selectedOfferProductName.value = rows[0]?.productName || ''
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="Failed to load asset workspace"
      :description="error.message"
    />

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Asset Workspace</h3>
        <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ selectedAsset?.name || 'Assets' }}</h2>
        <UBadge color="info" variant="soft" size="md" class="font-semibold">Asset Access: {{ assetAccessLabel }}</UBadge>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ selectedAsset ? `Selected asset: ${selectedAsset.name} (${selectedAsset.code})` : 'Select an asset from the list to start managing details and bindings.' }}
        </p>
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
            <option v-for="item in assetTypes" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-6 lg:items-stretch">
      <UCard :ui="{ root: 'min-h-[760px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }" class="lg:col-span-2">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Asset List</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ assets.length }} items</p>
          </div>
        </div>
        <div v-if="pending" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
        <div v-else-if="!assets.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No assets.</div>
        <div v-else class="flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <UTable
            :data="pagedAssets"
            :columns="assetColumns"
            sticky="header"
            class="asset-utable h-full overflow-auto min-w-full text-sm"
            @select="(_e, row) => { selectedAssetId = row.original.id }"
          >
            <template #no-header>
              <div class="w-full text-center">#</div>
            </template>
            <template #no-cell="{ row }">
              <div class="text-center text-sm text-slate-600 dark:text-slate-300">
                {{ (assetPage - 1) * assetPageSize + row.index + 1 }}
              </div>
            </template>
            <template #name-header>
              <div class="w-full text-center">Name / Code</div>
            </template>
            <template #name-cell="{ row }">
              <div class="leading-tight text-center">
                <p class="font-semibold text-slate-900 dark:text-slate-100">{{ row.original.name }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ row.original.code }}</p>
              </div>
            </template>
            <template #kind-header>
              <div class="w-full text-center">Type</div>
            </template>
            <template #kind-cell="{ row }">
              <div class="text-center">{{ row.original.kind }}</div>
            </template>
            <template #status-header>
              <div class="w-full text-center">Status</div>
            </template>
            <template #status-cell="{ row }">
              <div class="leading-tight text-center">
                <p class="text-sm font-semibold" :class="statusTextClass(row.original.status)">{{ row.original.status }}</p>
                <p class="text-sm font-medium" :class="readinessTextClass(row.original.readiness)">{{ readinessLabel(row.original.readiness) }}</p>
              </div>
            </template>
            <template #updatedAt-header>
              <div class="w-full text-center">Updated</div>
            </template>
            <template #updatedAt-cell="{ row }">
              <div class="leading-tight text-center">
                <p class="text-sm text-slate-800 dark:text-slate-100">{{ fmtDate(row.original.updatedAt) }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ fmtTime(row.original.updatedAt) }}</p>
              </div>
            </template>
          </UTable>
        </div>
        <div v-if="assets.length" class="mt-3 flex items-center justify-between">
          <div class="space-y-0.5">
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Showing {{ assetStartIndex }}-{{ assetEndIndex }} of {{ assets.length }}
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Page {{ assetPage }} / {{ assetTotalPages }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton size="sm" variant="soft" color="neutral" :disabled="assetPage <= 1" @click="prevAssetPage">Prev</UButton>
            <UButton size="sm" variant="soft" color="neutral" :disabled="assetPage >= assetTotalPages" @click="nextAssetPage">Next</UButton>
          </div>
        </div>
      </UCard>

      <div class="grid min-h-[560px] grid-rows-[auto_auto_1fr] gap-3 lg:col-span-4">
        <UCard class="order-1" :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Asset Detail</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Tenant:
              <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ selectedTenantName }}</span>
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Merchant:
              <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ selectedMerchantName }}</span>
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Branch:
              <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ selectedBranchName }}</span>
            </p>
          </div>
          <div v-if="pending" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          <div v-else-if="!selectedAsset" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No asset selected.</div>
          <div v-else class="space-y-3">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-5">
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Code</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ selectedAsset.code }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Name</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ selectedAsset.name }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Type</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ selectedAsset.kind }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Updated</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ fmtDate(selectedAsset.updatedAt) }} {{ fmtTime(selectedAsset.updatedAt) }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Status</p>
                <div class="leading-tight">
                  <p class="text-sm font-semibold" :class="statusTextClass(selectedAsset.status)">{{ selectedAsset.status }}</p>
                  <p class="text-sm font-medium" :class="readinessTextClass(selectedAssetReadiness)">{{ readinessLabel(selectedAssetReadiness) }}</p>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <UCard class="order-3" :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Products bound to this asset</p>
            <div class="flex items-center gap-2">
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ selectedAsset?.prices.length || 0 }} items</p>
              <UButton
                icon="i-lucide-link"
                color="primary"
                variant="solid"
                size="sm"
                class="text-white dark:text-white"
                :disabled="!canManageAsset || !selectedAssetId"
                @click="openAssetProductBinding"
              >
                Bind Product
              </UButton>
            </div>
          </div>
          <div v-if="!selectedAsset || !selectedAsset.prices.length" class="text-sm text-slate-500 dark:text-slate-400">No products linked.</div>
          <div v-else class="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            <div v-if="unbindProductError" class="border-b border-slate-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-slate-700 dark:bg-rose-950/40 dark:text-rose-300">
              {{ unbindProductError }}
            </div>
            <UTable
              :data="assetPriceRows"
              :columns="assetPriceColumns"
              sticky="header"
              class="asset-utable h-full overflow-auto min-w-full text-sm"
              @select="(_e, row) => { selectedOfferProductId = row.original.product?.id || '' }"
            >
              <template #productName-cell="{ row }">
                <span class="font-medium">{{ row.original.productName }}</span>
              </template>
              <template #serviceLabel-cell="{ row }">
                <div class="text-center">{{ row.original.serviceLabel }}</div>
              </template>
              <template #serviceLabel-header>
                <div class="w-full text-center">Service</div>
              </template>
              <template #serviceModeLabel-cell="{ row }">
                <div class="text-center">{{ row.original.serviceModeLabel }}</div>
              </template>
              <template #serviceModeLabel-header>
                <div class="w-full text-center">Service Mode</div>
              </template>
              <template #priceUnitLabel-cell="{ row }">
                <div class="text-center">{{ row.original.priceUnitLabel }}</div>
              </template>
              <template #priceUnitLabel-header>
                <div class="w-full text-center">Currency</div>
              </template>
              <template #serviceUnitLabel-cell="{ row }">
                <div class="text-center">{{ row.original.serviceUnitLabel }}</div>
              </template>
              <template #serviceUnitLabel-header>
                <div class="w-full text-center">Service Unit</div>
              </template>
              <template #promotionLabel-header>
                <div class="w-full text-center">Price / Promo</div>
              </template>
              <template #promotionLabel-cell="{ row }">
                <div class="text-center">
                  <button
                    v-if="row.original.currentOffer && row.original.product?.id"
                    type="button"
                    class="inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm font-medium text-amber-700 hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200"
                    @click="openOfferDetails(row.original.product.id)"
                  >
                    <span class="text-slate-500 line-through dark:text-slate-400">{{ row.original.amount }} THB</span>
                    <UIcon name="i-lucide-arrow-right" class="h-4 w-4" />
                    <span>{{ row.original.currentOffer.amount }} THB</span>
                    <UIcon name="i-lucide-badge-percent" class="h-4 w-4" />
                  </button>
                  <button
                    v-else-if="row.original.upcomingOffer && row.original.product?.id"
                    type="button"
                    class="inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-slate-600 hover:text-slate-500 dark:text-slate-300 dark:hover:text-slate-200"
                    @click="openOfferDetails(row.original.product.id)"
                  >
                    <span>{{ row.original.amount }}</span>
                    <UIcon name="i-lucide-clock-3" class="h-4 w-4 text-sky-500 dark:text-sky-300" />
                  </button>
                  <span v-else class="text-slate-600 dark:text-slate-300">
                    {{ row.original.amount }}
                  </span>
                </div>
              </template>
              <template #orderCount-header>
                <div class="w-full text-center">Orders</div>
              </template>
              <template #actions-header>
                <div class="w-full text-center">Action</div>
              </template>
              <template #orderCount-cell="{ row }">
                <div class="text-center">{{ row.original.orderCount }}</div>
              </template>
              <template #bindingLabel-cell="{ row }">
                <UBadge :color="row.original.active ? 'success' : 'warning'" variant="soft" size="sm" class="font-semibold">
                  {{ row.original.bindingLabel }}
                </UBadge>
              </template>
              <template #productStatusLabel-cell="{ row }">
                <UBadge :color="row.original.product?.active ? 'success' : 'error'" variant="soft" size="sm" class="font-semibold">
                  {{ row.original.productStatusLabel }}
                </UBadge>
              </template>
              <template #actions-cell="{ row }">
                <div class="flex items-center justify-center gap-1">
                  <UButton
                    :icon="(row.original.currentOffer?.id || row.original.upcomingOffer?.id) ? 'i-lucide-pause' : (row.original.pausedOffer?.id ? 'i-lucide-play' : 'i-lucide-percent')"
                    :color="row.original.pausedOffer?.id ? 'success' : 'warning'"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    :title="row.original.currentOffer?.id
                      ? 'Pause Current Promotion'
                      : (row.original.upcomingOffer?.id
                        ? 'Pause Upcoming Promotion'
                        : (row.original.pausedOffer?.id ? 'Resume Paused Promotion' : 'Set Promotion'))"
                    :disabled="!canManageAsset || !row.original.product?.id"
                    @click="row.original.currentOffer?.id
                      ? requestDisablePromotion(row.original.currentOffer.id, row.original.product?.name || row.original.product?.code || '', 'pause')
                      : (row.original.upcomingOffer?.id
                        ? requestDisablePromotion(row.original.upcomingOffer.id, row.original.product?.name || row.original.product?.code || '', 'pause')
                        : (row.original.pausedOffer?.id
                          ? requestDisablePromotion(row.original.pausedOffer.id, row.original.product?.name || row.original.product?.code || '', 'resume')
                          : openPromotionModal(row.original)))"
                  />
                  <UButton
                    v-if="row.original.upcomingOffer?.id"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    title="Delete Upcoming Promotion"
                    :disabled="!canManageAsset"
                    @click="requestDisablePromotion(row.original.upcomingOffer?.id, row.original.product?.name || row.original.product?.code || '', 'delete')"
                  />
                  <UButton
                    icon="i-lucide-qr-code"
                    color="info"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    title="Show Static ThaiQR"
                    :disabled="!canManageAsset || !row.original.product?.id"
                    @click="openStaticQrModal(row.original.product?.id)"
                  />
                  <UButton
                    :icon="row.original.active ? 'i-lucide-unlink-2' : 'i-lucide-link-2'"
                    :color="row.original.active ? 'error' : 'primary'"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    :loading="unbindProductSavingId === (row.original.product?.id || '')"
                    :disabled="!canManageAsset || (row.original.active ? (!row.original.product?.id || !row.original.canUnbind) : (!row.original.product?.id || !row.original.product?.active))"
                    :title="row.original.active
                      ? (row.original.canUnbind ? 'Unbind' : 'Cannot unbind: used in orders')
                      : (row.original.product?.active ? 'Rebind' : 'Cannot rebind: product is disabled')"
                    @click="row.original.product?.id ? (row.original.active ? unbindProduct(row.original.product.id) : rebindProduct(row.original.product.id)) : null"
                  />
                </div>
              </template>
            </UTable>
          </div>

          <div ref="offerSectionRef" class="mt-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <div class="mb-2 flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Promotion Offers : <span class="text-slate-900 dark:text-white">{{ assetPriceRows.find(r => r.product?.id === selectedOfferProductId)?.productName || 'All' }}</span>
              </p>
              <div class="flex items-center gap-2">
                <UButton size="xs" :variant="offerTab === 'current' ? 'solid' : 'soft'" color="neutral" @click="offerTab = 'current'">Current</UButton>
                <UButton size="xs" :variant="offerTab === 'upcoming' ? 'solid' : 'soft'" color="neutral" @click="offerTab = 'upcoming'">Upcoming</UButton>
                <UButton size="xs" :variant="offerTab === 'history' ? 'solid' : 'soft'" color="neutral" @click="offerTab = 'history'">History</UButton>
              </div>
            </div>
            <UAlert v-if="offerError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="offerError" class="mb-2" />
            <div v-if="offerLoading" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Loading offers...</div>
            <div v-else-if="!offerRows.length" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No offers.</div>
            <div v-else class="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
              <table class="w-full text-sm">
                <thead class="bg-slate-100/70 dark:bg-slate-800/70">
                  <tr>
                    <th class="px-3 py-2 text-left">Product</th>
                    <th class="px-3 py-2 text-left">Price</th>
                    <th class="px-3 py-2 text-left">Start</th>
                    <th class="px-3 py-2 text-left">End</th>
                    <th class="px-3 py-2 text-left">Priority</th>
                    <th class="px-3 py-2 text-left">Event At</th>
                    <th class="px-3 py-2 text-left">Reason</th>
                    <th class="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in offerRows" :key="item.id" class="border-t border-slate-200 dark:border-slate-700">
                    <td class="px-3 py-2">{{ item.product?.name || '-' }}</td>
                    <td class="px-3 py-2">{{ item.amount }} THB</td>
                    <td class="px-3 py-2">
                      <p class="text-sm text-slate-800 dark:text-slate-100">{{ fmtDate(item.effectiveFrom) }}</p>
                      <p class="text-[10px] text-slate-500 dark:text-slate-400">{{ fmtTime(item.effectiveFrom) }}</p>
                    </td>
                    <td class="px-3 py-2">
                      <p class="text-sm text-slate-800 dark:text-slate-100">{{ item.effectiveTo ? fmtDate(item.effectiveTo) : 'No end' }}</p>
                      <p class="text-[10px] text-slate-500 dark:text-slate-400">{{ item.effectiveTo ? fmtTime(item.effectiveTo) : '-' }}</p>
                    </td>
                    <td class="px-3 py-2">P{{ item.priority }}</td>
                    <td class="px-3 py-2">
                      <p class="text-sm text-slate-800 dark:text-slate-100">{{ fmtDate(item.updatedAt || item.effectiveFrom) }}</p>
                      <p class="text-[10px] text-slate-500 dark:text-slate-400">{{ fmtTime(item.updatedAt || item.effectiveFrom) }}</p>
                    </td>
                    <td class="px-3 py-2">{{ item.reason || '-' }}</td>
                    <td class="px-3 py-2 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <UButton
                          v-if="item.active"
                          icon="i-lucide-pause"
                          color="warning"
                          variant="ghost"
                          size="sm"
                          class="h-8 w-8"
                          title="Pause Promotion"
                          :disabled="!canManageAsset"
                          @click="requestDisablePromotion(item.id, item.product?.name || item.product?.code || '', 'pause')"
                        />
                        <UButton
                          v-else-if="String(item.reason || '').toLowerCase().includes('pause')"
                          icon="i-lucide-play"
                          color="success"
                          variant="ghost"
                          size="sm"
                          class="h-8 w-8"
                          title="Resume Promotion"
                          :disabled="!canManageAsset"
                          @click="requestDisablePromotion(item.id, item.product?.name || item.product?.code || '', 'resume')"
                        />
                        <UButton
                          v-if="offerTab === 'upcoming' && item.active"
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          size="sm"
                          class="h-8 w-8"
                          title="Delete Upcoming Promotion"
                          :disabled="!canManageAsset"
                          @click="requestDisablePromotion(item.id, item.product?.name || item.product?.code || '', 'delete')"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </UCard>

        <div class="order-2 grid gap-3 md:grid-cols-2 md:items-start">
          <IotBindingModal
            embedded
            :asset-id="selectedAssetId"
            :asset-name="selectedAsset?.name || selectedAsset?.code || ''"
            api-base="/api/app"
            :allow-unbind="false"
            :warning-border="selectedAssetReadiness !== 'READY'"
            @changed="refresh"
            @history="openOfferHistorySection"
          />
          <MachineBindingModal
            embedded
            :asset-id="selectedAssetId"
            :asset-name="selectedAsset?.name || selectedAsset?.code || ''"
            api-base="/api/app"
            :allow-unbind="false"
            :warning-border="selectedAssetReadiness !== 'READY'"
            @changed="refresh"
            @history="openOfferHistorySection"
          />
        </div>
      </div>
    </div>

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
              <UButton color="primary" class="text-white dark:text-white" :loading="bindDeviceSaving" :disabled="!canManageAsset || !bindDeviceId" @click="submitBindDevice">{{ activeBinding?.iotDevice ? 'Replace' : 'Bind' }}</UButton>
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
              <UButton color="primary" class="text-white dark:text-white" :loading="bindMachineSaving" :disabled="!canManageAsset || !bindMachineId" @click="submitBindMachine">{{ activeBinding?.machine ? 'Replace' : 'Bind' }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="promotionOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Set Promotion</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closePromotionModal" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="promotionError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="promotionError" />
            <UFormField label="Promotion Price (THB)">
              <UInput
                v-model="promotionAmount"
                type="number"
                min="0"
                class="w-full"
                :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                :class="{ 'text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400': true }"
              />
            </UFormField>
            <UFormField label="Priority">
              <UInput
                v-model="promotionPriority"
                type="number"
                min="1"
                max="999"
                class="w-full"
                :ui="{ base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }"
                :class="{ 'text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400': true }"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Start Date">
                <UPopover v-model:open="promotionStartCalendarOpen">
                  <UButton color="neutral" variant="outline" icon="i-lucide-calendar" trailing class="h-10 w-full justify-between border-slate-300 bg-white text-sm font-medium text-slate-900 ring-1 ring-slate-300 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-500">
                    <span>{{ fmtInputDate(promotionStartDate) }}</span>
                  </UButton>
                  <template #content>
                    <div class="rounded-lg bg-white p-2 text-slate-900 ring-1 ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600">
                      <UCalendar v-model="promotionStartDate" @update:model-value="promotionStartCalendarOpen = false" />
                    </div>
                  </template>
                </UPopover>
              </UFormField>
              <UFormField label="Start Time">
                <UInput v-model="promotionStartTime" type="time" class="h-10 w-full" :ui="{ base: 'h-10 bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }" :class="{ 'text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400': true }" />
              </UFormField>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="End Date">
                <UPopover v-model:open="promotionEndCalendarOpen">
                  <UButton color="neutral" variant="outline" icon="i-lucide-calendar" trailing class="h-10 w-full justify-between border-slate-300 bg-white text-sm font-medium text-slate-900 ring-1 ring-slate-300 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-500">
                    <span>{{ fmtInputDate(promotionEndDate) }}</span>
                  </UButton>
                  <template #content>
                    <div class="rounded-lg bg-white p-2 text-slate-900 ring-1 ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600">
                      <UCalendar v-model="promotionEndDate" @update:model-value="promotionEndCalendarOpen = false" />
                    </div>
                  </template>
                </UPopover>
              </UFormField>
              <UFormField label="End Time">
                <UInput v-model="promotionEndTime" type="time" class="h-10 w-full" :ui="{ base: 'h-10 bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500' }" :class="{ 'text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400': true }" />
              </UFormField>
            </div>
            <label class="flex h-10 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input v-model="promotionReplaceActive" type="checkbox" class="h-4 w-4">
              Replace overlapping active promotion
            </label>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closePromotionModal">Cancel</UButton>
              <UButton color="primary" class="text-white dark:text-white" :loading="promotionSaving" :disabled="!canManageAsset || !promotionAmount || !promotionStartDate" @click="submitPromotion">Save Promotion</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <AssetStaticThaiQrModal
      :open="staticQrOpen"
      :loading="staticQrLoading"
      :error="staticQrError"
      :data="staticQrData"
      :copy-done="staticQrCopyDone"
      @update:open="(v) => { if (!v) closeStaticQrModal(); else staticQrOpen = true }"
      @copy="copyStaticQrText"
    />

    <UModal v-model:open="confirmDisablePromoOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Confirm Delete Promotion</h3>
          </template>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            {{ confirmPromotionAction === 'resume' ? 'Resume promotion for' : (confirmPromotionAction === 'delete' ? 'Delete promotion for' : 'Pause promotion for') }}
            <span class="font-semibold">{{ confirmDisablePromoLabel }}</span> ?
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="confirmDisablePromoOpen = false">Cancel</UButton>
              <UButton :color="confirmPromotionAction === 'resume' ? 'primary' : (confirmPromotionAction === 'delete' ? 'error' : 'warning')" @click="confirmDisablePromotion">
                {{ confirmPromotionAction === 'resume' ? 'Resume' : (confirmPromotionAction === 'delete' ? 'Delete' : 'Pause') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
:deep(.asset-utable thead) {
  background-color: rgb(30 41 59) !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 30 !important;
}

:deep(.asset-utable thead th) {
  color: rgb(203 213 225) !important;
  padding-top: 0.3rem !important;
  padding-bottom: 0.3rem !important;
}

.dark :deep(.asset-utable thead) {
  background-color: rgb(15 23 42) !important;
}

.dark :deep(.asset-utable thead th) {
  color: rgb(226 232 240) !important;
}

:deep(.asset-utable tbody td) {
  padding-top: 0.3rem !important;
  padding-bottom: 0.3rem !important;
}
</style>
