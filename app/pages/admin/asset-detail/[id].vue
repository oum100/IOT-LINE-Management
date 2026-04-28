<script setup lang="ts">
definePageMeta({
  middleware: "portal-auth",
})

type DeviceOption = {
  id: string
  macAddress: string
  deviceUid?: string | null
  status?: "SPARE" | "IN_USE" | "OFFLINE" | "DISABLED"
}

type MachineUnitOption = {
  id: string
  serialNo: string
  status?: "SPARE" | "IN_USE" | "OFFLINE" | "DISABLED"
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
    machineUnit?: { id: string; serialNo: string } | null
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
    machineUnit?: { id: string; serialNo: string } | null
  }>
  offersTimeline?: {
    current: ProductOffer[]
    upcoming: ProductOffer[]
    history: ProductOffer[]
  }
}

type ProductDisplayRow = {
  id: string
  productName: string
  pricingType: string
  updatedAt: string
  amount: number
  section: "CURRENT" | "UPCOMING" | "HISTORY"
}

const route = useRoute()
const loading = ref(false)
const error = ref("")
const saving = ref(false)
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

const devices = ref<DeviceOption[]>([])
const machineUnits = ref<MachineUnitOption[]>([])
const currentOffers = ref<ProductOffer[]>([])
const upcomingOffers = ref<ProductOffer[]>([])
const historyOffers = ref<ProductOffer[]>([])

const replaceDeviceForm = ref({
  iotDeviceId: "",
  reason: "",
})

const replaceMachineForm = ref({
  machineUnitId: "",
  reason: "",
})

const id = computed(() => String(route.params.id || "").trim())
const hasBoundIot = computed(() => Boolean(details.value?.activeBinding?.iotDevice?.id))
const hasBoundMachine = computed(() => Boolean(details.value?.activeBinding?.machineUnit?.id))
const iotBindingStatus = computed(() => (hasBoundIot.value ? "IN_USE" : "UNASSIGNED"))
const machineBindingStatus = computed(() => (hasBoundMachine.value ? "IN_USE" : "UNASSIGNED"))
const assignmentStatus = computed(() => details.value?.assignmentStatus || "UNASSIGNED")
const assignmentToneClass = computed(() => {
  if (assignmentStatus.value === "ASSIGNED") return "text-emerald-600 dark:text-emerald-300"
  if (assignmentStatus.value === "PARTIAL_ASSIGNED") return "text-amber-600 dark:text-amber-300"
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
    label: `MAC: ${item.macAddress}${item.deviceUid ? ` | UID: ${item.deviceUid}` : ""} | ${item.status || "SPARE"}`,
    value: item.id,
  }))
)

const machineUnitOptions = computed(() =>
  machineUnits.value.map(item => ({
    label: `${item.serialNo} [${item.status || "SPARE"}]`,
    value: item.id,
  }))
)

const productRows = computed<ProductDisplayRow[]>(() => [
  ...currentOffers.value.map((offer) => ({
    id: offer.id,
    productName: offer.product?.name || offer.productId,
    pricingType: offer.pricingType,
    updatedAt: offer.updatedAt || offer.effectiveFrom,
    amount: Number(offer.amount || 0),
    section: "CURRENT" as const,
  })),
  ...upcomingOffers.value.map((offer) => ({
    id: offer.id,
    productName: offer.product?.name || offer.productId,
    pricingType: offer.pricingType,
    updatedAt: offer.updatedAt || offer.effectiveFrom,
    amount: Number(offer.amount || 0),
    section: "UPCOMING" as const,
  })),
  ...historyOffers.value.map((offer) => ({
    id: offer.id,
    productName: offer.product?.name || offer.productId,
    pricingType: offer.pricingType,
    updatedAt: offer.updatedAt || offer.effectiveFrom,
    amount: Number(offer.amount || 0),
    section: "HISTORY" as const,
  })),
])

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

async function loadMachineUnitOptions() {
  if (!id.value) return
  const response = await $fetch<{ items: MachineUnitOption[] }>(`/api/admin/assets/${id.value}/available-machine-units`)
  machineUnits.value = response.items || []
  if (replaceMachineForm.value.machineUnitId && !machineUnits.value.some(item => item.id === replaceMachineForm.value.machineUnitId)) {
    replaceMachineForm.value.machineUnitId = ""
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

async function replaceMachineUnit() {
  if (!id.value) return
  if (!replaceMachineForm.value.machineUnitId) {
    tabError.value = "Please select machine unit."
    return
  }

  saving.value = true
  tabError.value = ""
  try {
    await $fetch(`/api/admin/assets/${id.value}/replace-machine`, {
      method: "POST",
      body: {
        machineUnitId: replaceMachineForm.value.machineUnitId,
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

function onProductEdit(row: ProductDisplayRow) {
  setTabMessage(`Edit product pricing for ${row.productName} is coming next.`)
}

function onProductHistory(row: ProductDisplayRow) {
  setTabMessage(`History view for ${row.productName} is coming next.`)
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
  if (status === "IN_USE") return "text-emerald-600 dark:text-emerald-300"
  return "text-amber-600 dark:text-amber-300"
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
  return allRows.filter(item => Boolean(item.machineUnit?.id))
})

function openBindingHistory(type: "iot" | "machine") {
  historyDialogType.value = type
  historyDialogOpen.value = true
}

async function searchAssetAndOpen() {
  const q = (assetSearch.value || "").trim()
  if (!q) {
    tabError.value = "Please enter asset name, code, UUID, or ID."
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
    loadMachineUnitOptions(),
    loadProductData(),
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
    replaceMachineForm.value.machineUnitId = ""
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
        <UInput v-model="assetSearch" placeholder="Search asset by name/code/UUID/ID" class="w-[320px]" :ui="{ base: 'bg-white dark:bg-slate-900' }" @keyup.enter="searchAssetAndOpen" />
        <UButton color="primary" variant="soft" icon="i-lucide-search" :loading="saving" @click="searchAssetAndOpen">Search</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left" @click="backToAssets">Back to Assets</UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
    <UAlert v-if="tabMessage" color="success" variant="soft" icon="i-lucide-check-circle-2" :title="tabMessage" />
    <UAlert v-if="tabError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="tabError" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">{{ details?.name || "-" }}</h2>
          <UButton color="primary" variant="soft" icon="i-lucide-refresh-cw" :loading="loading" @click="loadDetails">Refresh</UButton>
        </div>
      </template>

      <div v-if="loading && !details" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading asset detail...</div>

      <div v-else-if="details" class="space-y-3">
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-4">
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Asset UUID</p>
            <div class="mt-0.5 flex items-center gap-2">
              <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ details.assetUuid }}</p>
              <CopyIconButton :value="details.assetUuid" aria-label="Copy Asset UUID" />
            </div>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Asset Code</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.code }}</p>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Type</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.kind }}</p>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Status</p>
            <p class="mt-1 text-sm font-semibold" :class="statusToneClass">{{ details.status }}</p>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Tenant</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.tenant?.name || "-" }}</p>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Merchant (Brand)</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.branch?.merchantAccount?.name || "-" }}</p>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Branch</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.branch?.name || "-" }}</p>
          </div>
          <div class="py-0.5">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Assignment</p>
            <p class="mt-1 text-sm font-semibold" :class="assignmentToneClass">{{ assignmentStatus }}</p>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">IoT Device Binding</h3>
          <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-5">
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Bound IoT</p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.activeBinding?.iotDevice?.macAddress || "Not bound" }}</p>
            </div>
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Device UID</p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.activeBinding?.iotDevice?.deviceUid || "-" }}</p>
            </div>
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Binding At</p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ formatDate(details.activeBinding?.startedAt) }}</p>
            </div>
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Status</p>
              <p class="mt-1 text-sm font-semibold" :class="bindingStatusClass(iotBindingStatus)">{{ iotBindingStatus }}</p>
            </div>
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Reason</p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.activeBinding?.reason || "-" }}</p>
            </div>
          </div>

          <div class="mt-2 grid gap-2 md:grid-cols-[360px_1fr_auto_auto]">
            <USelect v-model="replaceDeviceForm.iotDeviceId" placeholder="Select spare IoT device" :items="deviceOptions" :ui="selectUi" class="w-full" />
            <UInput v-model="replaceDeviceForm.reason" placeholder="Bind/replace reason (optional)" :ui="{ base: 'bg-white dark:bg-slate-900' }" />
            <UButton color="primary" class="h-10 w-[132px] justify-center" :loading="saving" @click="replaceIotDevice">{{ hasBoundIot ? "Replace Now" : "Bind Now" }}</UButton>
            <UButton color="neutral" variant="soft" class="h-10 w-[132px] justify-center" icon="i-lucide-history" @click="openBindingHistory('iot')">History</UButton>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">Machine Binding</h3>
          <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-5">
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Bound Machine</p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.activeBinding?.machineUnit?.serialNo || "Not bound" }}</p>
            </div>
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Machine Unit ID</p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.activeBinding?.machineUnit?.id || "-" }}</p>
            </div>
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Binding At</p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ formatDate(details.activeBinding?.startedAt) }}</p>
            </div>
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Status</p>
              <p class="mt-1 text-sm font-semibold" :class="bindingStatusClass(machineBindingStatus)">{{ machineBindingStatus }}</p>
            </div>
            <div class="py-0.5">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Reason</p>
              <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ details.activeBinding?.reason || "-" }}</p>
            </div>
          </div>

          <div class="mt-2 grid gap-2 md:grid-cols-[360px_1fr_auto_auto]">
            <USelect v-model="replaceMachineForm.machineUnitId" placeholder="Select spare machine unit" :items="machineUnitOptions" :ui="selectUi" class="w-full" />
            <UInput v-model="replaceMachineForm.reason" placeholder="Bind/replace reason (optional)" :ui="{ base: 'bg-white dark:bg-slate-900' }" />
            <UButton color="primary" class="h-10 w-[132px] justify-center" :loading="saving" @click="replaceMachineUnit">{{ hasBoundMachine ? "Replace Now" : "Bind Now" }}</UButton>
            <UButton color="neutral" variant="soft" class="h-10 w-[132px] justify-center" icon="i-lucide-history" @click="openBindingHistory('machine')">History</UButton>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">Product Info</h3>
          <div class="mt-2 overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
            <table class="w-full min-w-[780px] text-sm">
              <thead class="bg-slate-100/80 dark:bg-slate-800/80">
                <tr class="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  <th class="px-3 py-2">Product</th>
                  <th class="px-3 py-2">Type</th>
                  <th class="px-3 py-2">Amount</th>
                  <th class="px-3 py-2">Updated At</th>
                  <th class="px-3 py-2">Set</th>
                  <th class="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in productRows" :key="row.id" class="border-t border-slate-200 dark:border-slate-700">
                  <td class="px-3 py-2 font-semibold text-slate-900 dark:text-white">{{ row.productName }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.pricingType }}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{{ row.amount }}</td>
                  <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ formatDate(row.updatedAt) }}</td>
                  <td class="px-3 py-2"><UBadge variant="soft" color="neutral">{{ row.section }}</UBadge></td>
                  <td class="px-3 py-2 text-right">
                    <div class="inline-flex items-center gap-1">
                      <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" title="Edit" @click="onProductEdit(row)" />
                      <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-history" title="History" @click="onProductHistory(row)" />
                    </div>
                  </td>
                </tr>
                <tr v-if="!productRows.length">
                  <td colspan="6" class="px-3 py-5 text-center text-xs text-slate-500 dark:text-slate-400">No product offers found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">Order Info / Payment Info</h3>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <UInput v-model="orderSearch" placeholder="Search order no./customer/order id" class="w-[280px]" :ui="{ base: 'bg-white dark:bg-slate-900' }" @keyup.enter="applyOrderFilters" />
            <USelect v-model="orderStatusFilter" class="w-[220px]" :items="orderStatusOptions" :ui="selectUi" />
            <USelect v-model="paymentStatusFilter" class="w-[220px]" :items="paymentStatusOptions" :ui="selectUi" />
            <UButton color="primary" variant="soft" icon="i-lucide-search" :loading="orderListLoading" @click="applyOrderFilters">Apply</UButton>
          </div>

          <div class="mt-2 grid gap-2 lg:grid-cols-[1.7fr_.7fr]">
            <div class="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
              <div class="mb-2 flex items-center justify-between">
                <h4 class="text-base font-semibold text-slate-900 dark:text-white">Order List</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ orderItems.length }} orders</p>
              </div>
              <div class="max-h-[340px] overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table class="w-full min-w-[860px] text-xs">
                  <thead class="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-800/90">
                    <tr class="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th class="px-3 py-2">Order</th>
                      <th class="px-3 py-2">Status</th>
                      <th class="px-3 py-2">Payment</th>
                      <th class="px-3 py-2">Customer</th>
                      <th class="px-3 py-2">Amount</th>
                      <th class="px-3 py-2 text-right">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in orderItems"
                      :key="item.id"
                      class="cursor-pointer border-t border-slate-200 transition-colors dark:border-slate-700"
                      :class="selectedOrderId === item.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70'"
                      @click="selectOrder(item)"
                    >
                      <td class="px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white">{{ item.orderNumber }}</td>
                      <td class="px-3 py-2"><UBadge variant="soft" :color="orderStatusBadgeColor(item.status)">{{ item.status }}</UBadge></td>
                      <td class="px-3 py-2"><UBadge variant="soft" :color="paymentStatusBadgeColor(item.payment?.status || 'NO_PAYMENT')">{{ item.payment?.status || "NO_PAYMENT" }}</UBadge></td>
                      <td class="px-3 py-2"><UBadge variant="soft" color="neutral">{{ item.customerName || "-" }}</UBadge></td>
                      <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ item.totalAmount }}</td>
                      <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">{{ formatDate(item.createdAt) }}</td>
                    </tr>
                    <tr v-if="!orderListLoading && !orderItems.length">
                      <td colspan="6" class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No orders found for this asset.</td>
                    </tr>
                    <tr v-if="orderListLoading">
                      <td colspan="6" class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">Loading orders...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mt-2 flex items-center justify-between">
                <p class="text-xs text-slate-500 dark:text-slate-400">Page {{ orderPage }} / {{ orderTotalPages }} ({{ orderTotal }} total)</p>
                <div class="flex items-center gap-2">
                  <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevrons-left" :disabled="!hasPrevOrderPage || orderListLoading" @click="goToOrderPage(1)" />
                  <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevron-left" :disabled="!hasPrevOrderPage || orderListLoading" @click="goToOrderPage(orderPage - 1)" />
                  <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevron-right" :disabled="!hasNextOrderPage || orderListLoading" @click="goToOrderPage(orderPage + 1)" />
                  <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevrons-right" :disabled="!hasNextOrderPage || orderListLoading" @click="goToOrderPage(orderTotalPages)" />
                </div>
              </div>
            </div>

            <div class="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
              <div class="mb-2">
                <h4 class="text-base font-semibold text-slate-900 dark:text-white">Payment Timeline</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ selectedOrder ? `Order ${selectedOrder.orderNumber}` : "Select an order from the left list" }}</p>
              </div>
              <div v-if="orderTimelineLoading" class="text-xs text-slate-500 dark:text-slate-400">Loading timeline...</div>
              <div v-else class="max-h-[340px] overflow-auto pr-1">
                <UTimeline :items="timelineItems" />
                <p v-if="selectedOrder && !paymentTimeline.length" class="text-xs text-slate-500 dark:text-slate-400">No payment timeline events.</p>
              </div>
            </div>
          </div>
        </div>
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
                  {{ historyDialogType === "iot" ? (row.iotDevice?.macAddress || "-") : (row.machineUnit?.serialNo || "-") }}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ formatDate(row.startedAt) }}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ formatDate(row.endedAt || undefined) }}</td>
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
  </section>
</template>
