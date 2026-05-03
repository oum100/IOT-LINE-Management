<script setup lang="ts">
definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})

type DashboardSummary = {
  scope: string
  tenant?: { id: string; code: string; name: string } | null
  order: {
    total: number
    pendingPayment: number
    inProgress: number
    completed: number
  }
  payment: {
    total: number
  }
  merchant: {
    total: number
    active: number
    suspended: number
    disabled: number
  }
  branch: {
    total: number
    active: number
    suspended: number
    disabled: number
  }
  device: {
    total: number
    active: number
    inUse: number
    spare: number
    offline: number
  }
  machine: {
    total: number
    active: number
    inUse: number
    spare: number
    offline: number
  }
  insight?: {
    start: string
    end: string
    topProducts: Array<{
      id: string
      label: string
      revenue: number
      useCount: number
    }>
    topAssets: Array<{
      id: string
      label: string
      revenue: number
      useCount: number
    }>
  }
}

type ExplorerResponse = {
  filters: {
    start: string
    end: string
  }
  totals: {
    revenue: number
    orders: number
    payments: number
  }
  rows: Array<{
    id: string
    label: string
    amount: number
    orderCount: number
    paymentCount: number
  }>
  assets?: {
    total: number
    active: number
    inactive: number
    maintenance: number
  }
  trend7d?: Array<{
    key: string
    label: string
    amount: number
  }>
}

const { data: summaryData } = await useFetch<DashboardSummary>('/api/app/dashboard')
const { data: totalsData } = await useFetch<ExplorerResponse>('/api/app/dashboard-explorer', {
  query: {
    groupBy: 'merchant',
    metric: 'revenue',
    mode: 'all',
    period: 'month'
  }
})
const { data: topNowData } = await useFetch<ExplorerResponse>('/api/app/dashboard-explorer', {
  query: {
    groupBy: 'merchant',
    metric: 'revenue',
    mode: 'top5',
    period: '24h'
  }
})

const tenantName = computed(() => summaryData.value?.tenant?.name || '-')
const tenantCode = computed(() => summaryData.value?.tenant?.code || '-')
const order = computed(() => summaryData.value?.order || {
  total: 0,
  pendingPayment: 0,
  inProgress: 0,
  completed: 0
})
const payment = computed(() => summaryData.value?.payment || { total: 0 })
const merchant = computed(() => summaryData.value?.merchant || { total: 0, active: 0, suspended: 0, disabled: 0 })
const branch = computed(() => summaryData.value?.branch || { total: 0, active: 0, suspended: 0, disabled: 0 })
const device = computed(() => summaryData.value?.device || { total: 0, active: 0, inUse: 0, spare: 0, offline: 0 })
const machine = computed(() => summaryData.value?.machine || { total: 0, active: 0, inUse: 0, spare: 0, offline: 0 })
const topProducts = computed(() => summaryData.value?.insight?.topProducts || [])
const topAssets = computed(() => summaryData.value?.insight?.topAssets || [])
const totals = computed(() => totalsData.value?.totals || {
  revenue: 0,
  orders: 0,
  payments: 0
})
const topMerchants = computed(() => topNowData.value?.rows || [])
const assets = computed(() => totalsData.value?.assets || {
  total: 0,
  active: 0,
  inactive: 0,
  maintenance: 0
})
const trend7d = computed(() => totalsData.value?.trend7d || [])
const trendMax = computed(() => {
  const values = trend7d.value.map(item => Number(item.amount || 0))
  return Math.max(1, ...values)
})
const topProductsMax = computed(() => {
  const values = topProducts.value.map(item => Number(item.revenue || 0))
  return Math.max(1, ...values)
})
const topAssetsMax = computed(() => {
  const values = topAssets.value.map(item => Number(item.useCount || 0))
  return Math.max(1, ...values)
})

function fmtNumber(value: number) {
  return Number(value || 0).toLocaleString('en-US')
}

function formatDateOnly(value?: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const rangeLabel = computed(() => {
  const start = formatDateOnly(totalsData.value?.filters?.start)
  const end = formatDateOnly(totalsData.value?.filters?.end)
  return `Data range: ${start} - ${end}`
})
const insightRangeLabel = computed(() => {
  const start = formatDateOnly(summaryData.value?.insight?.start)
  const end = formatDateOnly(summaryData.value?.insight?.end)
  return `${start} - ${end}`
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Dashboard</p>
        <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ tenantName }}</h2>
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ rangeLabel }}</p>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'p-4' }">
        <div class="grid gap-3 sm:grid-cols-[1.15fr_1fr] sm:items-stretch">
          <div class="rounded-xl border border-emerald-300/70 bg-emerald-950 px-4 py-3 shadow-[0_0_0_1px_rgba(16,185,129,0.15)] dark:border-emerald-700/70">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/90">Revenue</p>
            <p class="mt-1 text-4xl font-extrabold leading-none text-emerald-300 sm:text-[2.2rem]">{{ fmtNumber(totals.revenue) }}</p>
            <p class="mt-2 text-[11px] font-medium text-emerald-100/80">Total sales in selected range</p>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <div class="rounded-lg border border-blue-300/70 bg-blue-100/80 px-3 py-2 dark:border-blue-900/60 dark:bg-blue-950/35">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-blue-900 dark:text-blue-200">Order</p>
              <p class="text-xl font-extrabold text-blue-700 dark:text-blue-300">{{ fmtNumber(order.total) }}</p>
            </div>
            <div class="rounded-lg border border-violet-300/70 bg-violet-100/80 px-3 py-2 dark:border-violet-900/60 dark:bg-violet-950/35">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">Payment</p>
              <p class="text-xl font-extrabold text-violet-700 dark:text-violet-300">{{ fmtNumber(payment.total) }}</p>
            </div>
            <div class="rounded-lg border border-amber-300/70 bg-amber-100/90 px-3 py-2 sm:col-span-2 dark:border-amber-900/60 dark:bg-amber-950/35">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">Pending Payment</p>
              <p class="text-xl font-extrabold text-amber-700 dark:text-amber-300">{{ fmtNumber(order.pendingPayment) }}</p>
            </div>
          </div>
        </div>
      </UCard>

      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'p-3' }">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-xs text-slate-500 dark:text-slate-400">Mini Trend</p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400">7D</p>
        </div>
        <div v-if="!trend7d.length" class="rounded bg-slate-100 px-2 py-6 text-center text-xs text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
          No data
        </div>
        <div v-else class="grid grid-cols-7 gap-1">
          <div v-for="point in trend7d" :key="point.key" class="flex flex-col items-center gap-1">
            <div class="relative h-14 w-full rounded bg-slate-100 dark:bg-slate-800/70">
              <div
                class="absolute bottom-0 left-0 right-0 rounded bg-blue-500"
                :style="{ height: `${Math.max(8, Math.round((point.amount / trendMax) * 100))}%` }"
              />
            </div>
            <p class="text-[9px] text-slate-500 dark:text-slate-400">{{ point.label }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <div class="grid gap-3 md:grid-cols-5">
      <UCard :ui="{ root: 'ring-1 ring-slate-200/70 bg-white dark:ring-slate-700 dark:bg-slate-900', body: 'p-3' }">
        <div class="grid grid-cols-[1fr_auto] items-start gap-3">
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Merchant</p>
            <p class="text-xl font-bold text-slate-900 dark:text-slate-100">{{ fmtNumber(merchant.total) }}</p>
          </div>
          <div class="grid grid-cols-3 gap-1 text-[11px]">
            <span class="col-span-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-center font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span class="block leading-tight">ACTIVE</span>
              <span class="block leading-tight">{{ fmtNumber(merchant.active) }}</span>
            </span>
            <span class="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-center font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <span class="block leading-tight">SUSPENDED</span>
              <span class="block leading-tight">{{ fmtNumber(merchant.suspended) }}</span>
            </span>
            <span class="col-span-3 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-center font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">DISABLED {{ fmtNumber(merchant.disabled) }}</span>
          </div>
        </div>
      </UCard>
      <UCard :ui="{ root: 'ring-1 ring-slate-200/70 bg-white dark:ring-slate-700 dark:bg-slate-900', body: 'p-3' }">
        <div class="grid grid-cols-[1fr_auto] items-start gap-3">
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Branch</p>
            <p class="text-xl font-bold text-slate-900 dark:text-slate-100">{{ fmtNumber(branch.total) }}</p>
          </div>
          <div class="grid grid-cols-3 gap-1 text-[11px]">
            <span class="col-span-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-center font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span class="block leading-tight">ACTIVE</span>
              <span class="block leading-tight">{{ fmtNumber(branch.active) }}</span>
            </span>
            <span class="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-center font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <span class="block leading-tight">SUSPENDED</span>
              <span class="block leading-tight">{{ fmtNumber(branch.suspended) }}</span>
            </span>
            <span class="col-span-3 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-center font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">DISABLED {{ fmtNumber(branch.disabled) }}</span>
          </div>
        </div>
      </UCard>
      <UCard :ui="{ root: 'ring-1 ring-slate-200/70 bg-white dark:ring-slate-700 dark:bg-slate-900', body: 'p-3' }">
        <div class="grid grid-cols-[1fr_auto] items-start gap-3">
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Asset</p>
            <p class="text-xl font-bold text-slate-900 dark:text-slate-100">{{ fmtNumber(assets.total) }}</p>
          </div>
          <div class="grid grid-cols-3 gap-1 text-[11px]">
            <span class="col-span-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-center font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span class="block leading-tight">ACTIVE</span>
              <span class="block leading-tight">{{ fmtNumber(assets.active) }}</span>
            </span>
            <span class="col-span-2 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-center font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <span class="block leading-tight">INACTIVE</span>
              <span class="block leading-tight">{{ fmtNumber(assets.inactive) }}</span>
            </span>
            <span class="col-span-3 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-center font-medium text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
              <span class="block leading-tight">MAINTENANCE</span>
              <span class="block leading-tight">{{ fmtNumber(assets.maintenance) }}</span>
            </span>
          </div>
        </div>
      </UCard>
      <UCard :ui="{ root: 'ring-1 ring-slate-200/70 bg-white dark:ring-slate-700 dark:bg-slate-900', body: 'p-3' }">
        <div class="grid grid-cols-[1fr_auto] items-start gap-3">
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Device</p>
            <p class="text-xl font-bold text-slate-900 dark:text-slate-100">{{ fmtNumber(device.total) }}</p>
          </div>
          <div class="grid grid-cols-3 gap-1 text-[11px]">
            <span class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-center font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">ACTIVE {{ fmtNumber(device.active) }}</span>
            <span class="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-center font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">IN_USE {{ fmtNumber(device.inUse) }}</span>
            <span class="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-center font-medium text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300">SPARE {{ fmtNumber(device.spare) }}</span>
            <span class="col-span-3 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-center font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">OFFLINE {{ fmtNumber(device.offline) }}</span>
          </div>
        </div>
      </UCard>
      <UCard :ui="{ root: 'ring-1 ring-slate-200/70 bg-white dark:ring-slate-700 dark:bg-slate-900', body: 'p-3' }">
        <div class="grid grid-cols-[1fr_auto] items-start gap-3">
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Machine</p>
            <p class="text-xl font-bold text-slate-900 dark:text-slate-100">{{ fmtNumber(machine.total) }}</p>
          </div>
          <div class="grid grid-cols-3 gap-1 text-[11px]">
            <span class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-center font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">ACTIVE {{ fmtNumber(machine.active) }}</span>
            <span class="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-center font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">IN_USE {{ fmtNumber(machine.inUse) }}</span>
            <span class="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-center font-medium text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300">SPARE {{ fmtNumber(machine.spare) }}</span>
            <span class="col-span-3 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-center font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">OFFLINE {{ fmtNumber(machine.offline) }}</span>
          </div>
        </div>
      </UCard>
    </div>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <p class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Health Strip</p>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">Pending Payments: <strong>{{ fmtNumber(order.pendingPayment) }}</strong></div>
        <div class="rounded-lg border border-orange-200 bg-orange-50/70 px-3 py-2 text-sm text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-300">Asset in Maintenance: <strong>{{ fmtNumber(assets.maintenance) }}</strong></div>
        <div class="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-sm text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">Devices Offline: <strong>{{ fmtNumber(device.offline) }}</strong></div>
        <div class="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">Completed Orders: <strong>{{ fmtNumber(order.completed) }}</strong></div>
      </div>
    </UCard>

    <div class="grid gap-3 lg:grid-cols-2">
      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Top Products</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ insightRangeLabel }}</p>
        </div>
        <div v-if="!topProducts.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No product usage data.</div>
        <div v-else class="space-y-2">
          <div v-for="item in topProducts" :key="item.id" class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div class="flex items-center justify-between gap-3">
              <p class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{{ item.label }}</p>
              <div class="flex items-center gap-3 text-xs">
                <span class="text-slate-500 dark:text-slate-400">{{ fmtNumber(item.useCount) }} uses</span>
                <span class="font-semibold text-emerald-600 dark:text-emerald-400">{{ fmtNumber(item.revenue) }}</span>
              </div>
            </div>
            <div class="mt-2 h-1.5 rounded bg-slate-100 dark:bg-slate-800">
              <div class="h-1.5 rounded bg-emerald-500" :style="{ width: `${Math.max(8, Math.round((item.revenue / topProductsMax) * 100))}%` }" />
            </div>
          </div>
        </div>
      </UCard>

      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Most Used Assets</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ insightRangeLabel }}</p>
        </div>
        <div v-if="!topAssets.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No asset usage data.</div>
        <div v-else class="space-y-2">
          <div v-for="item in topAssets" :key="item.id" class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div class="flex items-center justify-between gap-3">
              <p class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{{ item.label }}</p>
              <div class="flex items-center gap-3 text-xs">
                <span class="font-semibold text-blue-600 dark:text-blue-400">{{ fmtNumber(item.useCount) }} uses</span>
                <span class="text-slate-500 dark:text-slate-400">{{ fmtNumber(item.revenue) }}</span>
              </div>
            </div>
            <div class="mt-2 h-1.5 rounded bg-slate-100 dark:bg-slate-800">
              <div class="h-1.5 rounded bg-blue-500" :style="{ width: `${Math.max(8, Math.round((item.useCount / topAssetsMax) * 100))}%` }" />
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <div class="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Top 5 Merchants (24H)</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Revenue</p>
        </div>
        <div v-if="!topMerchants.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No sales data in last 24 hours.</div>
        <div v-else class="space-y-2">
          <div v-for="item in topMerchants" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
            <p class="truncate pr-3 text-sm text-slate-700 dark:text-slate-200">{{ item.label }}</p>
            <p class="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{{ fmtNumber(item.amount) }}</p>
          </div>
        </div>
      </UCard>

      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <p class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Quick Actions</p>
        <div class="grid gap-2">
          <NuxtLink to="/app/revenue" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Open Revenue</NuxtLink>
          <NuxtLink to="/admin/orders" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Open Orders</NuxtLink>
          <NuxtLink to="/admin/payment" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Open Payments</NuxtLink>
          <NuxtLink to="/admin/devices" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Open Devices</NuxtLink>
        </div>
      </UCard>
    </div>
  </div>
</template>
