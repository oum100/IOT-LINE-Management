<script setup lang="ts">
import IotBindingModal from '~/components/asset/IotBindingModal.vue'
import MachineBindingModal from '~/components/asset/MachineBindingModal.vue'
import ProductBindModal from '~/components/asset/ProductBindModal.vue'
import ProductUnbindModal from '~/components/asset/ProductUnbindModal.vue'
import StaticThaiQrModal from '~/components/asset/StaticThaiQrModal.vue'
import SetPromotionModal from '~/components/promotion/SetPromotionModal.vue'

definePageMeta({
  middleware: "portal-auth",
})

type DeviceOption = {
  id: string
  macAddress: string
  deviceUid?: string | null
  status?: "SPARE" | "BOUND" | "OFFLINE" | "DISABLED"
}

type MachineOption = {
  id: string
  serialNo: string
  status?: "SPARE" | "BOUND" | "OFFLINE" | "DISABLED"
}

type ProductOffer = {
  id: string
  productId: string
  pricingType: "STANDARD" | "PROMOTION" | "SPECIAL"
  amount: number
  durationMinutes: number
  priority: number
  effectiveFrom: string
  effectiveTo?: string | null
  updatedAt?: string
  active: boolean
  reason?: string | null
  product?: {
    id: string
    code: string
    name: string
  } | null
}

type OrderListItem = {
  id: string
  orderNumber: string
  customerName: string
  totalAmount: number
  status: string
  createdAt: string
  payment?: {
    id: string
    status: string
    amount: number
    createdAt: string
    updatedAt: string
    verifiedAt?: string | null
  } | null
}

type PaymentTimelineEvent = {
  id: string
  at: string | null
  title: string
  note: string
  tone: "neutral" | "primary" | "success" | "warning" | "error"
}

type AssetDetails = {
  id: string
  tenantId: string
  tenant?: {
    id: string
    code: string
    name: string
  } | null
  code: string
  name: string
  kind: string
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE"
  assignmentStatus?: "UNASSIGNED" | "PARTIAL_ASSIGNED" | "ASSIGNED"
  assetUuid: string
  metadata?: Record<string, any> | null
  branch?: {
    id: string
    code: string
    name: string
    merchantAccount?: {
      id: string
      code: string
      name: string
    } | null
  } | null
  activeBinding?: {
    id: string
    iotDevice?: { id: string; macAddress: string; deviceUid?: string | null } | null
    machine?: { id: string; serialNo: string } | null
    startedAt: string
    reason?: string | null
  } | null
  bindings?: Array<{
    id: string
    status: string
    startedAt: string
    endedAt?: string | null
    reason?: string | null
    metadata?: Record<string, any> | null
    iotDevice?: { id: string; macAddress: string; deviceUid?: string | null } | null
    machine?: { id: string; serialNo: string } | null
  }>
  offersTimeline?: {
    current: ProductOffer[]
    upcoming: ProductOffer[]
    history: ProductOffer[]
  }
}

type ProductDisplayRow = {
  productId: string
  code: string
  name: string
  kind: string
  price: number
  currency: string
  service: string
  serviceMode: string
  serviceUnit: string
  active: boolean
}

type BindableProduct = {
  id: string
  code: string
  name: string
  kind: string
  active: boolean
}

const route = useRoute()
const loading = ref(false)
const error = ref("")
const saving = ref(false)
const editSaving = ref(false)
const editError = ref("")
const editingField = ref<"name" | "kind" | "status" | "">("")
const details = ref<AssetDetails | null>(null)
const tabError = ref("")
const tabMessage = ref("")
const assetSearch = ref("")
const orderSearch = ref("")
const orderStatusFilter = ref("ALL")
const paymentStatusFilter = ref("ALL")
const orderListLoading = ref(false)
const orderTimelineLoading = ref(false)
const orderItems = ref<OrderListItem[]>([])
const orderTotal = ref(0)
const orderPage = ref(1)
const orderPageSize = ref(10)
const selectedOrderId = ref("")
const selectedOrder = ref<OrderListItem | null>(null)
const paymentTimeline = ref<PaymentTimelineEvent[]>([])
const historyDialogOpen = ref(false)
const historyDialogType = ref<"iot" | "machine">("iot")
const bindProductOpen = ref(false)
const bindProductLoading = ref(false)
const bindProductSubmitting = ref(false)
const bindProductError = ref("")
const bindProductIds = ref<string[]>([])
const bindableProducts = ref<BindableProduct[]>([])
const boundProducts = ref<Array<{
  id: string
  code: string
  name: string
  kind: string
  amount: number
  quantity: number | null
  serviceMode: string | null
  serviceUnit: string | null
  active: boolean
}>>([])
const quickBindOpen = ref(false)
const quickBindSubmitting = ref(false)
const quickBindError = ref("")
const quickBindProductId = ref("")
const unbindProductOpen = ref(false)
const unbindProductSubmitting = ref(false)
const unbindProductError = ref("")
const staticQrOpen = ref(false)
const staticQrLoading = ref(false)
const staticQrError = ref("")
const staticQrCopyDone = ref(false)
const staticQrData = ref<any>(null)
const promotionOpen = ref(false)
const promotionSaving = ref(false)
const promotionError = ref("")
const actionTargetRow = ref<ProductDisplayRow | null>(null)

const devices = ref<DeviceOption[]>([])
const machines = ref<MachineOption[]>([])
const currentOffers = ref<ProductOffer[]>([])
const upcomingOffers = ref<ProductOffer[]>([])
const historyOffers = ref<ProductOffer[]>([])

const replaceDeviceForm = ref({
  iotDeviceId: "",
  reason: "",
})

const replaceMachineForm = ref({
  machineId: "",
  reason: "",
})
const editForm = ref({
  name: "",
  kind: "WASHER",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "MAINTENANCE",
})

const id = computed(() => String(route.params.id || "").trim())
const hasBoundIot = computed(() => Boolean(details.value?.activeBinding?.iotDevice?.id))
const hasBoundMachine = computed(() => Boolean(details.value?.activeBinding?.machine?.id))
const iotBindingStatus = computed(() => (hasBoundIot.value ? "BOUND" : "UNASSIGNED"))
const machineBindingStatus = computed(() => (hasBoundMachine.value ? "BOUND" : "UNASSIGNED"))
const readinessStatus = computed(() => {
  const hasProduct = boundProducts.value.length > 0
  if (!hasBoundIot.value) return "MISSING_DEVICE"
  if (!hasBoundMachine.value) return "MISSING_MACHINE"
  if (!hasProduct) return "MISSING_PRODUCT"
  return "READY"
})
const readinessToneClass = computed(() => {
  if (readinessStatus.value === "READY") return "text-emerald-700 dark:text-emerald-300"
  if (readinessStatus.value === "MISSING_DEVICE" || readinessStatus.value === "MISSING_MACHINE") return "text-amber-600 dark:text-amber-300"
  return "text-rose-600 dark:text-rose-300"
})
const statusToneClass = computed(() => {
  const value = details.value?.status || ""
  if (value === "ACTIVE") return "text-emerald-600 dark:text-emerald-300"
  if (value === "INACTIVE") return "text-amber-600 dark:text-amber-300"
  if (value === "MAINTENANCE") return "text-rose-600 dark:text-rose-300"
  return "text-slate-900 dark:text-white"
})

const deviceOptions = computed(() =>
  devices.value.map(item => ({
    label: item.macAddress,
    value: item.id,
  }))
)

const machineOptions = computed(() =>
  machines.value.map(item => ({
    label: `${item.serialNo} [${displayBindingStatus(item.status)}]`,
    value: item.id,
  }))
)

const productRows = computed<ProductDisplayRow[]>(() =>
  boundProducts.value.map((item) => ({
    productId: item.id,
    code: item.code,
    name: item.name,
    kind: item.kind,
    price: Number(item.amount || 0),
    currency: 'THB',
    service: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '-',
    serviceMode: item.serviceMode || '-',
    serviceUnit: item.serviceUnit || '-',
    active: Boolean(item.active)
  }))
)

const orderStatusOptions = [
  { label: "All Order Status", value: "ALL" },
  { label: "PENDING_PAYMENT", value: "PENDING_PAYMENT" },
  { label: "SLIP_UPLOADED", value: "SLIP_UPLOADED" },
  { label: "CONFIRMED", value: "CONFIRMED" },
  { label: "IN_PROGRESS", value: "IN_PROGRESS" },
  { label: "COMPLETED", value: "COMPLETED" },
  { label: "CANCELLED", value: "CANCELLED" },
]

const paymentStatusOptions = [
  { label: "All Payment Status", value: "ALL" },
  { label: "PENDING", value: "PENDING" },
  { label: "SLIP_UPLOADED", value: "SLIP_UPLOADED" },
  { label: "VERIFIED", value: "VERIFIED" },
  { label: "REJECTED", value: "REJECTED" },
]

const selectUi = {
  base: "!bg-white !text-slate-900 ring-1 !ring-slate-300 dark:!bg-slate-800 dark:!text-slate-100 dark:!ring-slate-600",
  placeholder: "!text-slate-500 dark:!text-slate-400",
  content: "!bg-white dark:!bg-slate-800",
  item: "!text-slate-900 dark:!text-slate-100",
  value: "!text-slate-900 dark:!text-slate-100",
  trailingIcon: "!text-slate-600 dark:!text-slate-300",
}

const orderTotalPages = computed(() => Math.max(1, Math.ceil(orderTotal.value / orderPageSize.value)))
const hasPrevOrderPage = computed(() => orderPage.value > 1)
const hasNextOrderPage = computed(() => orderPage.value < orderTotalPages.value)

function setError(err: unknown) {
  error.value = err instanceof Error ? err.message : "Request failed"
}

function setTabError(err: unknown) {
  tabMessage.value = ""
  tabError.value = err instanceof Error ? err.message : "Request failed"
}

function setTabMessage(text: string) {
  tabError.value = ""
  tabMessage.value = text
}

function openEditAsset(focusField: "name" | "kind" | "status" = "name") {
  if (!details.value) return
  editingField.value = focusField
  editError.value = ""
  editForm.value = {
    name: details.value.name || "",
    kind: details.value.kind || "WASHER",
    status: details.value.status || "ACTIVE",
  }
}

function cancelEditAsset() {
  editingField.value = ""
  editError.value = ""
}

async function submitEditAsset() {
  if (!id.value) return
  editSaving.value = true
  editError.value = ""
  try {
    await $fetch(`/api/admin/assets/${id.value}`, {
      method: "PATCH",
      body: {
        name: editForm.value.name.trim(),
        kind: editForm.value.kind,
        status: editForm.value.status,
      },
    })
    editingField.value = ""
    setTabMessage("Asset updated.")
    await loadDetails()
  } catch (err) {
    editError.value = err instanceof Error ? err.message : "Failed to update asset."
  } finally {
    editSaving.value = false
  }
}

async function loadDetails() {
  if (!id.value) return
  loading.value = true
  error.value = ""
  try {
    details.value = await $fetch<AssetDetails>(`/api/admin/assets/${id.value}`)
  } catch (err) {
    details.value = null
    setError(err)
  } finally {
    loading.value = false
  }
}

async function loadDeviceOptions() {
  if (!id.value) return
  const response = await $fetch<{ items: DeviceOption[] }>(`/api/admin/assets/${id.value}/available-iot-devices`)
  devices.value = response.items || []
  if (replaceDeviceForm.value.iotDeviceId && !devices.value.some(item => item.id === replaceDeviceForm.value.iotDeviceId)) {
    replaceDeviceForm.value.iotDeviceId = ""
  }
}

async function loadMachineOptions() {
  if (!id.value) return
  const response = await $fetch<{ items: MachineOption[] }>(`/api/admin/assets/${id.value}/available-machine-units`)
  machines.value = response.items || []
  if (replaceMachineForm.value.machineId && !machines.value.some(item => item.id === replaceMachineForm.value.machineId)) {
    replaceMachineForm.value.machineId = ""
  }
}

async function loadProductData() {
  if (!id.value) return
  try {
    const response = await $fetch<{
      current: ProductOffer[]
      upcoming: ProductOffer[]
      history: ProductOffer[]
      resolvedCurrent: ProductOffer | null
      asset: { id: string; tenantId: string; kind: string }
    }>(`/api/admin/assets/${id.value}/products`)
    currentOffers.value = response.current || []
    upcomingOffers.value = response.upcoming || []
    historyOffers.value = response.history || []
  } catch (err) {
    currentOffers.value = []
    upcomingOffers.value = []
    historyOffers.value = []
    setTabError(err)
  }
}

async function loadBoundProducts() {
  if (!id.value) return
  try {
    const response = await $fetch<{ items: Array<{
      id: string
      code: string
      name: string
      kind: string
      amount: number
      quantity: number | null
      serviceMode: string | null
      serviceUnit: string | null
      active: boolean
    }> }>(`/api/admin/assets/${id.value}/products/bound`)
    boundProducts.value = response.items || []
  } catch {
    boundProducts.value = []
  }
}

async function loadAssetOrders() {
  if (!id.value) return
  orderListLoading.value = true
  try {
    const response = await $fetch<{ items: OrderListItem[]; total?: number; page?: number; pageSize?: number }>(`/api/admin/assets/${id.value}/orders`, {
      query: {
        q: orderSearch.value || undefined,
        orderStatus: orderStatusFilter.value !== "ALL" ? orderStatusFilter.value : undefined,
        paymentStatus: paymentStatusFilter.value !== "ALL" ? paymentStatusFilter.value : undefined,
        page: orderPage.value,
        pageSize: orderPageSize.value,
      },
    })
    orderItems.value = response.items || []
    orderTotal.value = Number(response.total || 0)
    orderPage.value = Number(response.page || orderPage.value)
    orderPageSize.value = Number(response.pageSize || orderPageSize.value)

    if (!orderItems.value.length) {
      selectedOrderId.value = ""
      selectedOrder.value = null
      paymentTimeline.value = []
      return
    }

    if (!selectedOrderId.value || !orderItems.value.some(item => item.id === selectedOrderId.value)) {
      selectedOrderId.value = orderItems.value[0]!.id
    }
    selectedOrder.value = orderItems.value.find(item => item.id === selectedOrderId.value) || null
    await loadPaymentTimeline(selectedOrderId.value)
  } catch (err) {
    setTabError(err)
  } finally {
    orderListLoading.value = false
  }
}

function applyOrderFilters() {
  orderPage.value = 1
  void loadAssetOrders()
}

function goToOrderPage(target: number) {
  const next = Math.min(Math.max(1, target), orderTotalPages.value)
  if (next === orderPage.value) return
  orderPage.value = next
  void loadAssetOrders()
}

async function loadPaymentTimeline(orderId: string) {
  if (!id.value || !orderId) return
  orderTimelineLoading.value = true
  try {
    const response = await $fetch<{ events: PaymentTimelineEvent[] }>(`/api/admin/assets/${id.value}/orders/${orderId}/payment-timeline`)
    paymentTimeline.value = response.events || []
  } catch (err) {
    paymentTimeline.value = []
    setTabError(err)
  } finally {
    orderTimelineLoading.value = false
  }
}

function selectOrder(item: OrderListItem) {
  selectedOrderId.value = item.id
  selectedOrder.value = item
  void loadPaymentTimeline(item.id)
}

async function replaceIotDevice() {
  if (!id.value) return
  if (!replaceDeviceForm.value.iotDeviceId) {
    tabError.value = "Please select IoT device."
    return
  }

  saving.value = true
  tabError.value = ""
  try {
    await $fetch(`/api/admin/assets/${id.value}/replace-device`, {
      method: "POST",
      body: {
        iotDeviceId: replaceDeviceForm.value.iotDeviceId,
        reason: replaceDeviceForm.value.reason || (hasBoundIot.value ? "replace-device" : "bind-device"),
      },
    })
    setTabMessage(hasBoundIot.value ? "IoT device replaced." : "IoT device bound.")
    await loadDetails()
  } catch (err) {
    setTabError(err)
  } finally {
    saving.value = false
  }
}

async function replaceMachine() {
  if (!id.value) return
  if (!replaceMachineForm.value.machineId) {
    tabError.value = "Please select machine."
    return
  }

  saving.value = true
  tabError.value = ""
  try {
    await $fetch(`/api/admin/assets/${id.value}/replace-machine`, {
      method: "POST",
      body: {
        machineId: replaceMachineForm.value.machineId,
        reason: replaceMachineForm.value.reason || (hasBoundMachine.value ? "replace-machine" : "bind-machine"),
      },
    })
    setTabMessage(hasBoundMachine.value ? "Machine unit replaced." : "Machine unit bound.")
    await loadDetails()
  } catch (err) {
    setTabError(err)
  } finally {
    saving.value = false
  }
}

function onBindingChanged() {
  setTabMessage("Asset binding updated.")
  void loadDetails()
}

function onProductEdit(row: ProductDisplayRow) {
  actionTargetRow.value = row
  promotionError.value = ""
  promotionOpen.value = true
}

function onProductHistory(row: ProductDisplayRow) {
  actionTargetRow.value = row
  unbindProductError.value = ""
  unbindProductOpen.value = true
}

const boundProductIds = computed(() => new Set(productRows.value.map(row => row.productId)))
const isProductActiveBound = (row: ProductDisplayRow) => row.active
const bindableProductOptions = computed(() =>
  bindableProducts.value
    .filter(item => !boundProductIds.value.has(item.id))
    .map(item => ({ label: `${item.name} (${item.code})`, value: item.id }))
)

async function loadBindableProducts() {
  if (!details.value) return
  const response = await $fetch<{ items: BindableProduct[] }>("/api/admin/products", {
    query: {
      tenantId: details.value.tenantId,
      page: 1,
      pageSize: 200,
    },
  })
  bindableProducts.value = response.items || []
}

async function openBindProductDialog() {
  if (!details.value) return
  bindProductOpen.value = true
  bindProductLoading.value = true
  bindProductError.value = ""
  bindProductIds.value = []
  try {
    await loadBindableProducts()
  } catch (err) {
    bindProductError.value = err instanceof Error ? err.message : "Failed to load products."
    bindableProducts.value = []
  } finally {
    bindProductLoading.value = false
  }
}

async function openQuickBind(row: ProductDisplayRow) {
  if (!details.value) return
  actionTargetRow.value = row
  quickBindError.value = ""
  quickBindProductId.value = row.productId
  quickBindOpen.value = true
  try {
    await loadBindableProducts()
  } catch (err) {
    quickBindError.value = err instanceof Error ? err.message : "Failed to load products."
    bindableProducts.value = []
  }
}

async function submitQuickBind() {
  if (!details.value || !quickBindProductId.value) {
    quickBindError.value = "Please select product."
    return
  }
  const merchantAccountId = details.value.branch?.merchantAccount?.id
  const branchId = details.value.branch?.id
  if (!merchantAccountId || !branchId) {
    quickBindError.value = "Missing merchant/branch context for this asset."
    return
  }
  quickBindSubmitting.value = true
  quickBindError.value = ""
  try {
    await $fetch(`/api/admin/products/${quickBindProductId.value}/bind`, {
      method: "POST",
      body: {
        tenantId: details.value.tenantId,
        merchantAccountId,
        branchId,
        assetId: details.value.id,
      },
    })
    quickBindOpen.value = false
    setTabMessage("Product bound successfully.")
    await loadProductData()
  } catch (err) {
    quickBindError.value = err instanceof Error ? err.message : "Failed to bind product."
  } finally {
    quickBindSubmitting.value = false
  }
}

async function submitUnbindProduct() {
  if (!id.value || !actionTargetRow.value?.productId) return
  unbindProductSubmitting.value = true
  unbindProductError.value = ""
  try {
    await $fetch(`/api/admin/assets/${id.value}/products/${actionTargetRow.value.productId}`, {
      method: "DELETE"
    })
    unbindProductOpen.value = false
    setTabMessage(`Product unbound: ${actionTargetRow.value.name}`)
    await loadProductData()
    await loadBoundProducts()
  } catch (err) {
    unbindProductError.value = err instanceof Error ? err.message : "Failed to unbind product."
  } finally {
    unbindProductSubmitting.value = false
  }
}

async function openStaticQr(row: ProductDisplayRow) {
  if (!id.value || !row.productId) return
  actionTargetRow.value = row
  staticQrOpen.value = true
  staticQrLoading.value = true
  staticQrError.value = ""
  staticQrData.value = null
  staticQrCopyDone.value = false
  try {
    staticQrData.value = await $fetch(`/api/admin/assets/${id.value}/products/${row.productId}-static-qr`)
  } catch (err) {
    staticQrError.value = err instanceof Error ? err.message : "Failed to build static QR."
  } finally {
    staticQrLoading.value = false
  }
}

async function copyStaticQrText() {
  const text = staticQrData.value?.qrText
  if (!text) return
  await navigator.clipboard.writeText(text)
  staticQrCopyDone.value = true
  setTimeout(() => { staticQrCopyDone.value = false }, 1200)
}

async function submitPromotion(payload: {
  productId: string
  branchId: string
  amount: number
  effectiveFrom: string
  effectiveTo: string | null
  priority: number
  replaceActive: boolean
}) {
  promotionSaving.value = true
  promotionError.value = ""
  try {
    await $fetch('/api/admin/promotions', {
      method: 'POST',
      body: {
        ...payload,
        reason: 'admin-asset-promotion'
      }
    })
    promotionOpen.value = false
    setTabMessage(`Promotion set for ${actionTargetRow.value?.name || 'product'}`)
    await loadProductData()
    await loadBoundProducts()
  } catch (err) {
    promotionError.value = err instanceof Error ? err.message : 'Failed to set promotion.'
  } finally {
    promotionSaving.value = false
  }
}

async function submitBindProduct() {
  if (!details.value) return
  if (!bindProductIds.value.length) {
    bindProductError.value = "Please select at least one product."
    return
  }
  const merchantAccountId = details.value.branch?.merchantAccount?.id
  const branchId = details.value.branch?.id
  if (!merchantAccountId || !branchId) {
    bindProductError.value = "Missing merchant/branch context for this asset."
    return
  }
  bindProductSubmitting.value = true
  bindProductError.value = ""
  try {
    await Promise.all(
      bindProductIds.value.map(productId =>
        $fetch(`/api/admin/products/${productId}/bind`, {
          method: "POST",
          body: {
            tenantId: details.value!.tenantId,
            merchantAccountId,
            branchId,
            assetId: details.value!.id,
          },
        })
      )
    )
    bindProductOpen.value = false
    setTabMessage(`Products bound successfully (${bindProductIds.value.length}).`)
    await loadProductData()
  } catch (err) {
    bindProductError.value = err instanceof Error ? err.message : "Failed to bind product."
  } finally {
    bindProductSubmitting.value = false
  }
}

function backToAssets() {
  const query: Record<string, string> = {}
  const tenantId = typeof route.query.tenantId === "string" ? route.query.tenantId : ""
  const merchantAccountId = typeof route.query.merchantAccountId === "string" ? route.query.merchantAccountId : ""
  const branchId = typeof route.query.branchId === "string" ? route.query.branchId : ""
  if (tenantId) query.tenantId = tenantId
  if (merchantAccountId) query.merchantAccountId = merchantAccountId
  if (branchId) query.branchId = branchId
  void navigateTo({ path: "/admin/assets", query })
}

function formatDate(value?: string) {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

function orderStatusBadgeColor(status: string) {
  if (status === "COMPLETED") return "success"
  if (status === "IN_PROGRESS" || status === "CONFIRMED") return "primary"
  if (status === "SLIP_UPLOADED") return "warning"
  if (status === "CANCELLED") return "error"
  return "neutral"
}

function paymentStatusBadgeColor(status?: string | null) {
  if (status === "VERIFIED") return "success"
  if (status === "SLIP_UPLOADED") return "warning"
  if (status === "REJECTED") return "error"
  if (status === "PENDING") return "primary"
  return "neutral"
}

function bindingStatusClass(status: string) {
  if (status === "BOUND" || status === "BOUND") return "text-emerald-600 dark:text-emerald-300"
  return "text-amber-600 dark:text-amber-300"
}

function displayBindingStatus(status?: string | null) {
  return status === "BOUND" ? "BOUND" : (status || "SPARE")
}

const timelineItems = computed(() =>
  paymentTimeline.value.map((event) => ({
    value: event.id,
    date: formatDate(event.at || undefined),
    title: event.title,
    description: event.note,
    icon:
      event.tone === "success"
        ? "i-lucide-check-circle-2"
        : event.tone === "warning"
          ? "i-lucide-alert-triangle"
          : event.tone === "error"
            ? "i-lucide-x-circle"
            : "i-lucide-circle-dot",
  }))
)

const bindingHistoryRows = computed(() => {
  const allRows = (details.value?.bindings || [])
    .slice()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  if (historyDialogType.value === "iot") {
    return allRows.filter(item => Boolean(item.iotDevice?.id))
  }
  return allRows.filter(item => Boolean(item.machine?.id))
})

function openBindingHistory(type: "iot" | "machine") {
  historyDialogType.value = type
  historyDialogOpen.value = true
}

async function searchAssetAndOpen() {
  const q = (assetSearch.value || "").trim()
  if (!q) {
    tabError.value = "Please enter asset name, code, or ID."
    return
  }

  saving.value = true
  tabError.value = ""
  try {
    const response = await $fetch<{ items: Array<{ id: string }> }>("/api/admin/assets", {
      query: {
        q,
        page: 1,
        pageSize: 1,
      },
    })
    const found = response.items?.[0]
    if (!found?.id) {
      setTabError("Asset not found.")
      return
    }

    const query: Record<string, string> = {}
    const tenantId = typeof route.query.tenantId === "string" ? route.query.tenantId : ""
    const merchantAccountId = typeof route.query.merchantAccountId === "string" ? route.query.merchantAccountId : ""
    const branchId = typeof route.query.branchId === "string" ? route.query.branchId : ""
    if (tenantId) query.tenantId = tenantId
    if (merchantAccountId) query.merchantAccountId = merchantAccountId
    if (branchId) query.branchId = branchId

    await navigateTo({ path: `/admin/asset-detail/${found.id}`, query })
    assetSearch.value = ""
  } catch (err) {
    setTabError(err)
  } finally {
    saving.value = false
  }
}

async function loadAllSections() {
  await Promise.allSettled([
    loadDeviceOptions(),
    loadMachineOptions(),
    loadProductData(),
    loadBoundProducts(),
    loadAssetOrders(),
  ])
}

onMounted(() => {
  void loadDetails()
})

watch(id, () => {
  void loadDetails()
})

watch(
  details,
  (value) => {
    if (!value) return
    replaceDeviceForm.value.iotDeviceId = ""
    replaceMachineForm.value.machineId = ""
    replaceDeviceForm.value.reason = ""
    replaceMachineForm.value.reason = ""
    void loadAllSections()
  },
  { immediate: true }
)
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Asset Details</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">View linked IoT device, machine, products, orders and payments</p>
      </div>
      <div class="flex items-center gap-2">
        <SearchInput v-model="assetSearch" placeholder="Search asset by name/code/ID" class="w-[320px]" @enter="searchAssetAndOpen" />
        <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left" @click="backToAssets">Back to Assets</UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
    <UAlert v-if="tabMessage" color="success" variant="soft" icon="i-lucide-check-circle-2" :title="tabMessage" />
    <UAlert v-if="tabError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="tabError" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-8">
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white">{{ details?.name || "-" }}</h2>
            <div class="flex flex-wrap items-center gap-4">
              <p class="text-sm text-slate-600 dark:text-slate-300">Tenant: <span class="font-semibold text-slate-900 dark:text-slate-100">{{ details?.tenant?.name || "-" }}</span></p>
              <p class="text-sm text-slate-600 dark:text-slate-300">Merchant: <span class="font-semibold text-slate-900 dark:text-slate-100">{{ details?.branch?.merchantAccount?.name || "-" }}</span></p>
              <p class="text-sm text-slate-600 dark:text-slate-300">Branch: <span class="font-semibold text-slate-900 dark:text-slate-100">{{ details?.branch?.name || "-" }}</span></p>
            </div>
          </div>
          <UButton color="neutral" variant="soft" class="text-slate-900 dark:text-slate-100" icon="i-lucide-refresh-cw" :loading="loading" @click="loadDetails">Refresh</UButton>
        </div>
      </template>

      <div v-if="loading && !details" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading asset detail...</div>

      <div v-else-if="details" class="space-y-3">
        <div class="grid grid-cols-1 gap-x-3 gap-y-1 md:grid-cols-5">
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Asset Code</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.code }}</p>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Asset Name</p>
            <div class="mt-1 flex items-center gap-2">
              <template v-if="editingField === 'name'">
                <UInput
                  v-model="editForm.name"
                  class="h-10 w-[260px]"
                  :ui="{ base: 'h-10 bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500' }"
                />
                <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="editSaving" @click="submitEditAsset" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEditAsset" />
              </template>
              <template v-else>
                <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ details.name }}</p>
                <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" class="text-slate-700 dark:text-slate-200" title="Edit Asset Name" aria-label="Edit Asset Name" @click="openEditAsset('name')" />
              </template>
            </div>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Type</p>
            <div class="mt-1 flex items-center gap-2">
              <template v-if="editingField === 'kind'">
                <select
                  v-model="editForm.kind"
                  class="h-10 w-[180px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="WASHER">WASHER</option>
                  <option value="DRYER">DRYER</option>
                  <option value="WATER">WATER</option>
                  <option value="VENDING">VENDING</option>
                </select>
                <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="editSaving" @click="submitEditAsset" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEditAsset" />
              </template>
              <template v-else>
                <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ details.kind }}</p>
                <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" class="text-slate-700 dark:text-slate-200" title="Edit Type" aria-label="Edit Type" @click="openEditAsset('kind')" />
              </template>
            </div>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Status</p>
            <div class="mt-1 flex items-center gap-2">
              <template v-if="editingField === 'status'">
                <select
                  v-model="editForm.status"
                  class="h-10 w-[180px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
                <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="editSaving" @click="submitEditAsset" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEditAsset" />
              </template>
              <template v-else>
                <p class="text-sm font-semibold" :class="statusToneClass">{{ details.status }}</p>
                <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" class="text-slate-700 dark:text-slate-200" title="Edit Status" aria-label="Edit Status" @click="openEditAsset('status')" />
              </template>
            </div>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Readiness</p>
            <p class="mt-1 text-sm font-semibold" :class="readinessToneClass">{{ readinessStatus }}</p>
          </div>
        </div>
        <UAlert
          v-if="editError"
          class="mt-2"
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          :title="editError"
        />

        <div class="grid gap-3 lg:grid-cols-2">
          <IotBindingModal
            embedded
            :asset-id="id"
            :asset-name="details?.name || details?.code || ''"
            @changed="onBindingChanged"
          />
          <MachineBindingModal
            embedded
            :asset-id="id"
            :asset-name="details?.name || details?.code || ''"
            @changed="onBindingChanged"
          />
        </div>

        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-base font-semibold text-slate-900 dark:text-white">Product Info</h3>
              <UButton color="primary" class="text-white" icon="i-lucide-link" @click="openBindProductDialog">Bind Product</UButton>
            </div>
          </template>
          <div class="mt-2 overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
            <table class="w-full min-w-[780px] text-sm">
              <thead class="bg-slate-100/80 dark:bg-slate-800/80">
                <tr class="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  <th class="px-3 py-2">Code</th>
                  <th class="px-3 py-2">Name</th>
                  <th class="px-3 py-2">Type</th>
                  <th class="px-3 py-2">Price</th>
                  <th class="px-3 py-2">Currency</th>
                  <th class="px-3 py-2">Service</th>
                  <th class="px-3 py-2">Service Mode</th>
                  <th class="px-3 py-2">Service Unit</th>
                  <th class="px-3 py-2">Status</th>
                  <th class="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in productRows" :key="row.productId" class="border-t border-slate-200 dark:border-slate-700">
                  <td class="px-3 py-2 font-semibold text-slate-900 dark:text-white">{{ row.code }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.name }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.kind }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.price }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.currency }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.service }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.serviceMode }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.serviceUnit }}</td>
                  <td class="px-3 py-2">
                    <UBadge :color="row.active ? 'success' : 'error'" variant="soft">{{ row.active ? 'ACTIVE' : 'INACTIVE' }}</UBadge>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <div class="inline-flex items-center gap-1">
                      <UButton size="xs" color="neutral" variant="ghost" class="text-amber-400 hover:text-amber-300" icon="i-lucide-percent" title="Set Promotion" @click="onProductEdit(row)" />
                      <UButton size="xs" color="neutral" variant="ghost" class="text-sky-400 hover:text-sky-300" icon="i-lucide-qr-code" title="Static ThaiQR" @click="openStaticQr(row)" />
                      <UButton
                        v-if="isProductActiveBound(row)"
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        class="text-rose-500 hover:text-rose-400"
                        icon="i-lucide-unlink"
                        title="Unbind Product"
                        @click="onProductHistory(row)"
                      />
                      <UButton
                        v-else
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        class="text-emerald-500 hover:text-emerald-400"
                        icon="i-lucide-link"
                        title="Bind Product"
                        @click="openQuickBind(row)"
                      />
                    </div>
                  </td>
                </tr>
                <tr v-if="!productRows.length">
                  <td colspan="10" class="px-3 py-5 text-center text-xs text-slate-500 dark:text-slate-400">No bound products found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <AdminAssetOrderPaymentPanel
          :order-search="orderSearch"
          :order-status-filter="orderStatusFilter"
          :payment-status-filter="paymentStatusFilter"
          :order-status-options="orderStatusOptions"
          :payment-status-options="paymentStatusOptions"
          :order-items="orderItems"
          :selected-order-id="selectedOrderId"
          :order-list-loading="orderListLoading"
          :order-page="orderPage"
          :order-total-pages="orderTotalPages"
          :order-total="orderTotal"
          :has-prev-order-page="hasPrevOrderPage"
          :has-next-order-page="hasNextOrderPage"
          :selected-order="selectedOrder"
          :order-timeline-loading="orderTimelineLoading"
          :timeline-items="timelineItems"
          :payment-timeline="paymentTimeline"
          @update:order-search="orderSearch = $event"
          @update:order-status-filter="orderStatusFilter = $event"
          @update:payment-status-filter="paymentStatusFilter = $event"
          @apply-filters="applyOrderFilters"
          @select-order="selectOrder"
          @go-to-order-page="goToOrderPage"
        />
      </div>
    </UCard>

    <UModal v-model:open="historyDialogOpen" :title="historyDialogType === 'iot' ? 'IoT Binding History' : 'Machine Binding History'">
      <template #body>
        <div class="max-h-[420px] overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
          <table class="w-full min-w-[780px] text-sm">
            <thead class="bg-slate-100/80 dark:bg-slate-800/80">
              <tr class="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                <th class="px-3 py-2">Device / Machine</th>
                <th class="px-3 py-2">Started At</th>
                <th class="px-3 py-2">Ended At</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in bindingHistoryRows" :key="row.id" class="border-t border-slate-200 dark:border-slate-700">
                <td class="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                  {{ historyDialogType === "iot" ? (row.iotDevice?.macAddress || "-") : (row.machine?.serialNo || "-") }}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300"><DateTimeTwoLine :value="row.startedAt" /></td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300"><DateTimeTwoLine :value="row.endedAt || undefined" /></td>
                <td class="px-3 py-2">
                  <UBadge variant="soft" :color="row.status === 'ACTIVE' ? 'success' : 'neutral'">{{ row.status }}</UBadge>
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ row.reason || "-" }}</td>
              </tr>
              <tr v-if="!bindingHistoryRows.length">
                <td colspan="5" class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No binding history found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <UButton color="neutral" variant="soft" @click="historyDialogOpen = false">Close</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="bindProductOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Bind Product to Asset</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="bindProductOpen = false" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="bindProductError" color="error" variant="soft" :title="bindProductError" />

            <UFormField label="Asset">
              <UInput
                :model-value="`${details?.name || '-'} (${details?.code || '-'})`"
                readonly
                class="w-full"
                :ui="{ base: 'h-10 w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' }"
              />
            </UFormField>

            <UFormField label="Product">
              <USelectMenu
                v-model="bindProductIds"
                class="w-full"
                :items="bindableProductOptions"
                value-key="value"
                multiple
                searchable
                :disabled="bindProductLoading"
                placeholder="Select one or more products"
                :ui="{
                  base: 'min-h-10 bg-white text-slate-900 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-500',
                  placeholder: 'text-slate-500 dark:text-slate-400',
                  content: 'bg-white dark:bg-slate-800',
                  item: 'text-slate-900 dark:text-slate-100'
                }"
              />
              <p v-if="!bindProductLoading && !bindableProductOptions.length" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                No available product to bind (already bound or no active product with matching type).
              </p>
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="bindProductOpen = false">Cancel</UButton>
              <UButton color="primary" class="text-white" icon="i-lucide-link" :loading="bindProductSubmitting" :disabled="!bindProductIds.length || bindProductLoading" @click="submitBindProduct">Bind Product</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <ProductBindModal
      v-model:open="quickBindOpen"
      v-model="quickBindProductId"
      :loading="quickBindSubmitting"
      :error="quickBindError"
      :options="bindableProducts"
      @submit="submitQuickBind"
    />

    <ProductUnbindModal
      v-model:open="unbindProductOpen"
      :loading="unbindProductSubmitting"
      :error="unbindProductError"
      :product-name="actionTargetRow?.name || ''"
      :product-code="actionTargetRow?.code || ''"
      @confirm="submitUnbindProduct"
    />

    <StaticThaiQrModal
      v-model:open="staticQrOpen"
      :loading="staticQrLoading"
      :error="staticQrError"
      :data="staticQrData"
      :copy-done="staticQrCopyDone"
      @copy="copyStaticQrText"
    />

    <SetPromotionModal
      v-model:open="promotionOpen"
      :saving="promotionSaving"
      :error="promotionError"
      :asset="{ name: details?.name || '-', code: details?.code || '-' }"
      :product="actionTargetRow ? { id: actionTargetRow.productId, code: actionTargetRow.code, name: actionTargetRow.name, amount: actionTargetRow.price } : null"
      :tenants="details?.tenant ? [{ id: details.tenant.id, code: details.tenant.code, name: details.tenant.name }] : []"
      :merchants="details?.branch?.merchantAccount ? [{ id: details.branch.merchantAccount.id, code: details.branch.merchantAccount.code, name: details.branch.merchantAccount.name }] : []"
      :branches="details?.branch ? [{ id: details.branch.id, code: details.branch.code, name: details.branch.name, merchantAccountId: details.branch.merchantAccount?.id }] : []"
      :default-merchant-id="details?.branch?.merchantAccount?.id"
      :default-branch-id="details?.branch?.id"
      @submit="submitPromotion"
    />

  </section>
</template>
