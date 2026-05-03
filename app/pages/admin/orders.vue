<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"

definePageMeta({
  middleware: "portal-auth",
})

type Tenant = { id: string; name: string; code: string }
type Merchant = { id: string; name: string; code: string }
type Branch = { id: string; name: string; code: string }
type PagingResponse<T> = { items: T[]; total: number; page: number; pageSize: number }
type OrderSummary = {
  totalCount: number
  pendingPaymentCount: number
  slipUploadedCount: number
  confirmedCount: number
  inProgressCount: number
  completedCount: number
  cancelledCount: number
}

type OrderItem = {
  id: string
  orderNumber: string
  customerName: string
  totalAmount: number
  status: "PENDING_PAYMENT" | "SLIP_UPLOADED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  tenant?: { id: string; name: string; code: string } | null
  merchantAccount?: { id: string; name: string } | null
  branch?: { id: string; name: string } | null
  payment?: { id: string; status: string; amount: number } | null
  items?: Array<{
    id: string
    priceLabel: string
    asset?: { code?: string | null; name?: string | null } | null
    product?: { code?: string | null; name?: string | null } | null
  }>
  createdAt: string
}
type RefundContext = {
  order: {
    id: string
    orderNumber: string
    totalAmount: number
    status: string
    createdAt: string
    payment?: { id: string; status: string; amount: number } | null
    items: Array<{
      id: string
      priceLabel: string
      amount: number
      status: string
    }>
  }
  refundableItems: Array<{
    id: string
    label: string
    amount: number
    refunded: number
    remaining: number
    status: string
  }>
  refunds: Array<{
    id: string
    status: string
    reason: string
    totalAmount: number
    providerRefundRef?: string | null
    createdAt: string
    auditLogs?: Array<{
      id: string
      action: string
      fromStatus?: string | null
      toStatus: string
      note?: string | null
      providerRefundRef?: string | null
      createdAt: string
    }>
    items: Array<{
      id: string
      amount: number
      reason?: string | null
      orderItem?: {
        id: string
        priceLabel: string
        amount: number
      } | null
    }>
  }>
}
type RefundTransitionAction = "APPROVE" | "REJECT" | "PROCESS" | "COMPLETE" | "FAIL"

const loading = ref(false)
const error = ref("")
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const search = ref("")
const filters = ref({
  tenantId: "",
  merchantAccountId: "",
  branchId: "",
  status: "",
})
const orderStatuses = [
  "PENDING_PAYMENT",
  "SLIP_UPLOADED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])
const items = ref<OrderItem[]>([])
const refundOpen = ref(false)
const refundLoading = ref(false)
const refundSubmitting = ref(false)
const refundError = ref("")
const refundData = ref<RefundContext | null>(null)
const refundOrder = ref<OrderItem | null>(null)
const refundReason = ref("")
const refundNote = ref("")
const refundAmounts = ref<Record<string, number>>({})
const refundTransitionBusy = ref<Record<string, boolean>>({})
const refundTransitionNotes = ref<Record<string, string>>({})
const refundProviderRefs = ref<Record<string, string>>({})
const summary = ref<OrderSummary>({
  totalCount: 0,
  pendingPaymentCount: 0,
  slipUploadedCount: 0,
  confirmedCount: 0,
  inProgressCount: 0,
  completedCount: 0,
  cancelledCount: 0,
})
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const { data: authData } = useAuth()
const roleKey = computed(() => String(authData.value?.user?.role || '').toUpperCase())
const canManageOrder = computed(() => roleKey.value === 'ADMIN')
const refundInputUi = {
  base: "bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-600"
}

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

function formatDateOnly(date: string) {
  return new Date(date).toLocaleDateString()
}

function formatTimeOnly(date: string) {
  return new Date(date).toLocaleTimeString()
}

function orderStatusClass(status: string) {
  if (status === "COMPLETED") return "text-emerald-500"
  if (status === "CANCELLED") return "text-rose-500"
  if (status === "IN_PROGRESS") return "text-violet-500"
  if (status === "CONFIRMED") return "text-blue-500"
  if (status === "SLIP_UPLOADED") return "text-cyan-500"
  return "text-amber-500"
}

function paymentStatusClass(status?: string) {
  if (!status) return "text-slate-500 dark:text-slate-400"
  if (status === "VERIFIED") return "text-emerald-500"
  if (status === "FAILED" || status === "REJECTED") return "text-rose-500"
  if (status === "PENDING") return "text-amber-500"
  return "text-blue-500"
}

function itemSummary(item: OrderItem) {
  const rows = item.items || []
  if (!rows.length) {
    return { assets: "-", products: "-" }
  }
  const assetSet = new Set<string>()
  const productSet = new Set<string>()
  for (const row of rows) {
    const assetName = row.asset?.name || row.asset?.code
    const productName = row.product?.name || row.product?.code || row.priceLabel
    if (assetName) assetSet.add(assetName)
    if (productName) productSet.add(productName)
  }
  return {
    assets: Array.from(assetSet).join(", ") || "-",
    products: Array.from(productSet).join(", ") || "-"
  }
}

async function loadTenants() {
  const response = await $fetch<PagingResponse<Tenant>>("/api/admin/tenants", {
    query: { page: 1, pageSize: 200 },
  })
  tenants.value = response.items || []
}

async function loadMerchants() {
  if (!filters.value.tenantId) {
    merchants.value = []
    return
  }
  const response = await $fetch<PagingResponse<Merchant>>("/api/admin/merchants", {
    query: { tenantId: filters.value.tenantId, page: 1, pageSize: 200 },
  })
  merchants.value = response.items || []
}

async function loadBranches() {
  if (!filters.value.tenantId) {
    branches.value = []
    return
  }
  const response = await $fetch<PagingResponse<Branch>>("/api/admin/branches", {
    query: {
      tenantId: filters.value.tenantId,
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      page: 1,
      pageSize: 200,
    },
  })
  branches.value = response.items || []
}

async function loadData() {
  loading.value = true
  error.value = ""
  try {
    const queryBase = {
      ...(filters.value.tenantId ? { tenantId: filters.value.tenantId } : {}),
      ...(filters.value.merchantAccountId ? { merchantAccountId: filters.value.merchantAccountId } : {}),
      ...(filters.value.branchId ? { branchId: filters.value.branchId } : {}),
      ...(filters.value.status ? { status: filters.value.status } : {}),
    }
    const [listRes, summaryRes] = await Promise.all([
      $fetch<PagingResponse<OrderItem>>("/api/admin/orders", {
        query: {
          ...queryBase,
          ...(search.value.trim() ? { q: search.value.trim() } : {}),
          page: page.value,
          pageSize: pageSize.value,
        },
      }),
      $fetch<OrderSummary>("/api/admin/orders/summary", { query: queryBase }),
    ])
    items.value = listRes.items || []
    total.value = Number(listRes.total || 0)
    summary.value = summaryRes
  } catch (err) {
    items.value = []
    total.value = 0
    error.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || "Failed to load orders"
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadData()
}

function closeRefundDialog() {
  refundOpen.value = false
  refundLoading.value = false
  refundSubmitting.value = false
  refundError.value = ""
  refundData.value = null
  refundOrder.value = null
  refundReason.value = ""
  refundNote.value = ""
  refundAmounts.value = {}
  refundTransitionBusy.value = {}
  refundTransitionNotes.value = {}
  refundProviderRefs.value = {}
}

async function openRefundDialog(item: OrderItem) {
  if (!canManageOrder.value) return
  refundOpen.value = true
  refundLoading.value = true
  refundError.value = ""
  refundOrder.value = item
  refundData.value = null
  refundAmounts.value = {}
  refundReason.value = "Machine did not start after payment"
  refundNote.value = ""
  try {
    const context = await $fetch<RefundContext>(`/api/admin/orders/${item.id}/refunds`)
    refundData.value = context
    const next: Record<string, number> = {}
    for (const row of context.refundableItems) {
      if (row.remaining > 0) next[row.id] = row.remaining
    }
    refundAmounts.value = next
    const notes: Record<string, string> = {}
    const refs: Record<string, string> = {}
    for (const rf of context.refunds || []) {
      notes[rf.id] = ""
      refs[rf.id] = rf.providerRefundRef || ""
    }
    refundTransitionNotes.value = notes
    refundProviderRefs.value = refs
  } catch (err) {
    refundError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || "Failed to load refund context"
  } finally {
    refundLoading.value = false
  }
}

async function reloadRefundContext() {
  if (!refundOrder.value) return
  const context = await $fetch<RefundContext>(`/api/admin/orders/${refundOrder.value.id}/refunds`)
  refundData.value = context
  const notes: Record<string, string> = {}
  const refs: Record<string, string> = {}
  for (const rf of context.refunds || []) {
    notes[rf.id] = refundTransitionNotes.value[rf.id] || ""
    refs[rf.id] = refundProviderRefs.value[rf.id] || rf.providerRefundRef || ""
  }
  refundTransitionNotes.value = notes
  refundProviderRefs.value = refs
}

function selectedRefundItems() {
  if (!refundData.value) return []
  return refundData.value.refundableItems
    .map((item) => ({
      orderItemId: item.id,
      amount: Number(refundAmounts.value[item.id] || 0)
    }))
    .filter((item) => item.amount > 0)
}

async function submitRefund() {
  if (!canManageOrder.value) return
  if (!refundData.value) return
  refundSubmitting.value = true
  refundError.value = ""
  try {
    const reason = refundReason.value.trim()
    if (!reason) throw new Error("Refund reason is required.")
    const itemsPayload = selectedRefundItems()
    if (!itemsPayload.length) throw new Error("Select at least one item and set refund amount.")

    await $fetch("/api/admin/refunds", {
      method: "POST",
      body: {
        orderId: refundData.value.order.id,
        reason,
        note: refundNote.value.trim() || undefined,
        items: itemsPayload
      }
    })

    void loadData()
    closeRefundDialog()
  } catch (err) {
    refundError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error)?.message || "Failed to submit refund"
  } finally {
    refundSubmitting.value = false
  }
}

function refundActionLabel(action: RefundTransitionAction) {
  if (action === "APPROVE") return "Approve"
  if (action === "REJECT") return "Reject"
  if (action === "PROCESS") return "Mark Processing"
  if (action === "COMPLETE") return "Mark Refunded"
  return "Mark Failed"
}

function allowedRefundActions(status: string): RefundTransitionAction[] {
  if (status === "REQUESTED") return ["APPROVE", "REJECT"]
  if (status === "APPROVED") return ["PROCESS", "REJECT"]
  if (status === "PROCESSING") return ["COMPLETE", "FAIL"]
  if (status === "FAILED") return ["PROCESS"]
  return []
}

async function runRefundAction(refundId: string, action: RefundTransitionAction) {
  if (!canManageOrder.value) return
  if (!refundData.value) return
  refundTransitionBusy.value[refundId] = true
  refundError.value = ""
  try {
    await $fetch(`/api/admin/refunds/${refundId}/transition`, {
      method: "POST",
      body: {
        action,
        note: refundTransitionNotes.value[refundId] || undefined,
        providerRefundRef: refundProviderRefs.value[refundId] || undefined
      }
    })
    await reloadRefundContext()
    void loadData()
  } catch (err) {
    refundError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || "Failed to transition refund"
  } finally {
    refundTransitionBusy.value[refundId] = false
  }
}

watch(
  () => filters.value.tenantId,
  async () => {
    filters.value.merchantAccountId = ""
    filters.value.branchId = ""
    await Promise.all([loadMerchants(), loadBranches()])
    applyFilters()
  },
)

watch(
  () => filters.value.merchantAccountId,
  async () => {
    filters.value.branchId = ""
    await loadBranches()
    applyFilters()
  },
)

watch(
  () => filters.value.branchId,
  () => {
    applyFilters()
  },
)

watch(
  () => filters.value.status,
  () => {
    applyFilters()
  },
)

onMounted(async () => {
  try {
    await loadTenants()
  } catch {
    tenants.value = []
  }
  await loadData()
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Order Management</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">View and search orders by tenant/merchant (brand)/branch</p>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-[220px_220px_220px_180px_1fr] md:items-end">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Tenant</label>
            <select v-model="filters.tenantId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All tenants</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Merchant (Brand)</label>
            <select v-model="filters.merchantAccountId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All merchant (brand)</option>
              <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.id">{{ merchant.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Branch</label>
            <select v-model="filters.branchId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All branches</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-300">Status</label>
            <select v-model="filters.status" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All status</option>
              <option v-for="statusOption in orderStatuses" :key="statusOption" :value="statusOption">{{ statusOption }}</option>
            </select>
          </div>
          <SearchInput
            v-model="search"
            placeholder="Search order no/customer/id..."
            @enter="applyFilters"
          />
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        <UCard :ui="{ root: 'bg-emerald-50/70 dark:bg-emerald-950/25 ring-1 ring-emerald-200 dark:ring-emerald-700/40' }"><p class="text-xs text-emerald-700 dark:text-emerald-300">Total</p><p class="text-2xl font-bold text-emerald-700 dark:text-emerald-200">{{ summary.totalCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Pending</p><p class="text-2xl font-bold text-amber-500">{{ summary.pendingPaymentCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Slip Uploaded</p><p class="text-2xl font-bold text-cyan-500">{{ summary.slipUploadedCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Confirmed</p><p class="text-2xl font-bold text-blue-500">{{ summary.confirmedCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">In Progress</p><p class="text-2xl font-bold text-violet-500">{{ summary.inProgressCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Completed</p><p class="text-2xl font-bold text-emerald-500">{{ summary.completedCount }}</p></UCard>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-slate-700' }"><p class="text-xs text-slate-500 dark:text-slate-400">Cancelled</p><p class="text-2xl font-bold text-rose-500">{{ summary.cancelledCount }}</p></UCard>
      </div>

      <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              <th class="px-3 py-2">Order</th>
              <th class="px-3 py-2">Customer</th>
              <th class="px-3 py-2 text-center">Status / Payment</th>
              <th class="px-3 py-2">Amount</th>
              <th class="px-3 py-2">Asset / Product</th>
              <th class="px-3 py-2">Tenant</th>
              <th class="px-3 py-2">Machine</th>
              <th class="px-3 py-2">Branch</th>
              <th class="px-3 py-2">Created</th>
              <th class="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
              <td class="px-3 py-2 font-medium">{{ item.orderNumber }}</td>
              <td class="px-3 py-2">{{ item.customerName }}</td>
              <td class="px-3 py-2 text-center">
                <div class="space-y-0.5">
                  <p :class="orderStatusClass(item.status)">{{ item.status }}</p>
                  <p :class="['text-xs', paymentStatusClass(item.payment?.status)]">{{ item.payment?.status || "-" }}</p>
                </div>
              </td>
              <td class="px-3 py-2">{{ item.totalAmount }}</td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                <div class="space-y-0.5">
                  <p class="flex items-center gap-1.5">
                    <span class="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-slate-200 px-1 text-[10px] font-semibold leading-none text-slate-700 dark:bg-slate-700 dark:text-slate-100">A</span>
                    <span>{{ itemSummary(item).assets }}</span>
                  </p>
                  <p class="flex items-center gap-1.5">
                    <span class="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-slate-200 px-1 text-[10px] font-semibold leading-none text-slate-700 dark:bg-slate-700 dark:text-slate-100">P</span>
                    <span>{{ itemSummary(item).products }}</span>
                  </p>
                </div>
              </td>
              <td class="px-3 py-2">{{ item.tenant?.name || "-" }}</td>
              <td class="px-3 py-2">{{ item.merchantAccount?.name || "-" }}</td>
              <td class="px-3 py-2">{{ item.branch?.name || "-" }}</td>
              <td class="px-3 py-2">
                <div class="space-y-0.5">
                  <p>{{ formatDateOnly(item.createdAt) }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ formatTimeOnly(item.createdAt) }}</p>
                </div>
              </td>
              <td class="px-3 py-2">
                <UButton
                  icon="i-lucide-rotate-ccw"
                  size="xs"
                  color="warning"
                  variant="soft"
                  :disabled="!canManageOrder || item.payment?.status !== 'VERIFIED'"
                  @click="openRefundDialog(item)"
                >
                  Refund
                </UButton>
              </td>
            </tr>
            <tr v-if="!loading && items.length === 0">
              <td colspan="10" class="px-3 py-6 text-center text-slate-500">No orders found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between text-sm">
        <p class="text-slate-500 dark:text-slate-400">Showing {{ items.length }} of {{ total }} orders</p>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-chevron-left" color="neutral" variant="soft" :disabled="page <= 1" @click="page -= 1; loadData()" />
          <span class="text-xs text-slate-500 dark:text-slate-400">Page {{ page }} / {{ totalPages }}</span>
          <UButton icon="i-lucide-chevron-right" color="neutral" variant="soft" :disabled="page >= totalPages" @click="page += 1; loadData()" />
        </div>
      </div>
    </UCard>

    <UModal v-model:open="refundOpen" :ui="{ content: 'sm:max-w-4xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Refund Request</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeRefundDialog" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="refundError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="refundError" />
            <div v-if="refundLoading" class="py-8 text-center text-sm text-slate-500">Loading...</div>
            <template v-else-if="refundData">
              <div class="grid gap-3 sm:grid-cols-3">
                <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <p class="text-xs text-slate-500 dark:text-slate-400">Order</p>
                  <p class="font-semibold text-slate-900 dark:text-slate-100">{{ refundData.order.orderNumber }}</p>
                </div>
                <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <p class="text-xs text-slate-500 dark:text-slate-400">Payment</p>
                  <p class="font-semibold text-slate-900 dark:text-slate-100">{{ refundData.order.payment?.status || "-" }}</p>
                </div>
                <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <p class="text-xs text-slate-500 dark:text-slate-400">Order Total</p>
                  <p class="font-semibold text-slate-900 dark:text-slate-100">{{ refundData.order.totalAmount }}</p>
                </div>
              </div>

              <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table class="min-w-full text-sm">
                  <thead class="bg-slate-100 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    <tr>
                      <th class="px-3 py-2">Refund</th>
                      <th class="px-3 py-2">Item</th>
                      <th class="px-3 py-2">Amount</th>
                      <th class="px-3 py-2">Refunded</th>
                      <th class="px-3 py-2">Remaining</th>
                      <th class="px-3 py-2">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in refundData.refundableItems" :key="row.id" class="border-t border-slate-200 dark:border-slate-800">
                      <td class="px-3 py-2">
                        <input
                          type="checkbox"
                          class="h-4 w-4 rounded border-slate-300"
                          :checked="Number(refundAmounts[row.id] || 0) > 0"
                          :disabled="row.remaining <= 0"
                          @change="(evt) => { refundAmounts[row.id] = (evt.target as HTMLInputElement).checked ? row.remaining : 0 }"
                        >
                      </td>
                      <td class="px-3 py-2">{{ row.label }}</td>
                      <td class="px-3 py-2">{{ row.amount }}</td>
                      <td class="px-3 py-2">{{ row.refunded }}</td>
                      <td class="px-3 py-2">{{ row.remaining }}</td>
                      <td class="px-3 py-2">
                        <input
                          v-model.number="refundAmounts[row.id]"
                          type="number"
                          min="0"
                          :max="row.remaining"
                          :disabled="row.remaining <= 0"
                          class="w-28 rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <UFormField>
                  <template #label>
                    <span>Refund Reason <span class="text-rose-500">*</span></span>
                  </template>
                  <UInput v-model="refundReason" placeholder="Machine did not start after payment" :ui="refundInputUi" />
                </UFormField>
                <UFormField label="Note (optional)">
                  <UInput v-model="refundNote" placeholder="Additional note for audit trail" :ui="refundInputUi" />
                </UFormField>
              </div>

              <div>
                <p class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Recent Refund Requests</p>
                <div v-if="!refundData.refunds.length" class="text-sm text-slate-500 dark:text-slate-400">No refund history</div>
                <div v-else class="space-y-2">
                  <div v-for="rf in refundData.refunds" :key="rf.id" class="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="font-medium text-slate-900 dark:text-slate-100">{{ rf.status }} · {{ rf.totalAmount }} · {{ formatDate(rf.createdAt) }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">{{ rf.id }}</p>
                    </div>
                    <p class="text-slate-500 dark:text-slate-400">{{ rf.reason }}</p>
                    <div class="mt-2 grid gap-2 sm:grid-cols-[1fr_220px_auto]">
                      <input
                        v-model="refundTransitionNotes[rf.id]"
                        type="text"
                        placeholder="Transition note"
                        class="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                      <input
                        v-model="refundProviderRefs[rf.id]"
                        type="text"
                        placeholder="Provider refund ref"
                        class="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                      <div class="flex flex-wrap gap-1">
                        <UButton
                          v-for="action in allowedRefundActions(rf.status)"
                          :key="`${rf.id}-${action}`"
                          size="xs"
                          color="warning"
                          variant="soft"
                          :loading="refundTransitionBusy[rf.id]"
                          :disabled="!canManageOrder"
                          @click="runRefundAction(rf.id, action)"
                        >
                          {{ refundActionLabel(action) }}
                        </UButton>
                      </div>
                    </div>
                    <div v-if="rf.auditLogs?.length" class="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs dark:border-slate-700">
                      <p
                        v-for="log in rf.auditLogs.slice(0, 5)"
                        :key="log.id"
                        class="text-slate-500 dark:text-slate-400"
                      >
                        {{ formatDate(log.createdAt) }} · {{ log.action }} · {{ log.fromStatus || "-" }} -> {{ log.toStatus }}{{ log.providerRefundRef ? ` · ${log.providerRefundRef}` : "" }}{{ log.note ? ` · ${log.note}` : "" }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeRefundDialog">Cancel</UButton>
              <UButton color="warning" :loading="refundSubmitting" :disabled="!canManageOrder || refundLoading || !refundData" @click="submitRefund">Submit Refund</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
