<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { ApexOptions } from 'apexcharts'

definePageMeta({
  layout: 'admin',
  middleware: 'portal-auth'
})

type PeriodPreset = 'day' | 'week' | 'month' | 'year' | 'custom'
type GroupBy = 'tenant' | 'merchant' | 'branch'
type Metric = 'revenue' | 'orders' | 'payments'
type Mode = 'all' | 'top5' | 'top10' | 'custom'

type TenantOption = { id: string; code: string; name: string }
type MerchantOption = { id: string; code: string; name: string; tenantId: string }
type BranchOption = { id: string; code: string; name: string; tenantId: string; merchantAccountId: string }
type DeviceTypeOption = { code: string; name: string }

type ExplorerResponse = {
  filters: {
    groupBy: GroupBy
    metric: Metric
    mode: Mode
    period: PeriodPreset
    start: string
    end: string
    tenantIds: string[]
    merchantIds: string[]
    branchIds: string[]
  }
  totals: {
    revenue: number
    orders: number
    payments: number
  }
  rows: Array<{
    id: string
    label: string
    parentLabel?: string
    amount: number
    orderCount: number
    paymentCount: number
    paymentAmount: number
  }>
  timeline: {
    categories: string[]
    series: Array<{
      id: string
      name: string
      data: number[]
    }>
  }
  deviceTypeTimeline?: {
    categories: string[]
    series: Array<{
      id: string
      name: string
      data: number[]
    }>
  }
  deviceTypeOptions?: DeviceTypeOption[]
}

const ApexChart = defineAsyncComponent(async () => (await import('vue3-apexcharts')).default)
const colorMode = useColorMode()

const groupBy = ref<GroupBy>('tenant')
const metric = ref<Metric>('revenue')
const mode = ref<Mode>('all')
const period = ref<PeriodPreset>('month')
const startDate = ref('')
const endDate = ref('')
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const selectedYear = ref(String(new Date().getFullYear()))
const selectedDayInMonth = ref(new Date().getDate())
const selectedTenantIds = ref<string[]>([])
const selectedMerchantIds = ref<string[]>([])
const selectedBranchIds = ref<string[]>([])
const selectedDeviceTypes = ref<string[]>(['__NONE__'])
const selectedDeviceTypeCodes = computed(() => selectedDeviceTypes.value.filter(item => item !== '__NONE__'))

const { data: tenantListData } = await useFetch<{ items: TenantOption[] }>('/api/admin/tenants')
const tenantOptions = computed(() => tenantListData.value?.items || [])
const { data: merchantListData } = await useFetch<{ items: MerchantOption[] }>('/api/admin/merchants', {
  query: { page: 1, pageSize: 200 }
})
const merchantOptions = computed(() => merchantListData.value?.items || [])
const { data: branchListData } = await useFetch<{ items: BranchOption[] }>('/api/admin/branches', {
  query: { page: 1, pageSize: 200 }
})
const branchOptions = computed(() => branchListData.value?.items || [])

const filteredMerchantOptions = computed(() => {
  if (!selectedTenantIds.value.length) return merchantOptions.value
  const tenantSet = new Set(selectedTenantIds.value)
  return merchantOptions.value.filter(item => tenantSet.has(item.tenantId))
})

const filteredBranchOptions = computed(() => {
  const tenantSet = new Set(selectedTenantIds.value)
  const merchantSet = new Set(selectedMerchantIds.value)
  return branchOptions.value.filter((item) => {
    const tenantOk = !tenantSet.size || tenantSet.has(item.tenantId)
    const merchantOk = !merchantSet.size || merchantSet.has(item.merchantAccountId)
    return tenantOk && merchantOk
  })
})

watch(filteredMerchantOptions, (items) => {
  const allowed = new Set(items.map(item => item.id))
  selectedMerchantIds.value = selectedMerchantIds.value.filter(id => allowed.has(id))
}, { immediate: true })

watch(filteredBranchOptions, (items) => {
  const allowed = new Set(items.map(item => item.id))
  selectedBranchIds.value = selectedBranchIds.value.filter(id => allowed.has(id))
}, { immediate: true })

function monthStartEnd(monthValue: string) {
  const [yearRaw, monthRaw] = monthValue.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const start = new Date(year, month - 1, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

const dayOptionsInSelectedMonth = computed(() => {
  const { end } = monthStartEnd(selectedMonth.value)
  const totalDays = end.getDate()
  return Array.from({ length: totalDays }, (_, i) => i + 1)
})

watch(dayOptionsInSelectedMonth, (options) => {
  if (!options.includes(selectedDayInMonth.value)) {
    selectedDayInMonth.value = options[0] || 1
  }
}, { immediate: true })

function dayStartEnd(monthValue: string, dayInMonth: number) {
  const [yearRaw, monthRaw] = monthValue.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Math.max(1, dayInMonth || 1)
  const start = new Date(year, month - 1, day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(year, month - 1, day)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function rangeQueryFor(periodValue: PeriodPreset, monthValue: string, yearValue: string, dayInMonth: number, customStart: string, customEnd: string) {
  if (periodValue === 'custom') {
    return {
      start: customStart || undefined,
      end: customEnd || undefined
    }
  }
  if (periodValue === 'day') {
    const range = dayStartEnd(monthValue, dayInMonth)
    return {
      start: range.start.toISOString(),
      end: range.end.toISOString()
    }
  }
  if (periodValue === 'week') {
    const range = monthStartEnd(monthValue)
    return {
      start: range.start.toISOString(),
      end: range.end.toISOString()
    }
  }
  if (periodValue === 'month') {
    const range = monthStartEnd(monthValue)
    return {
      start: range.start.toISOString(),
      end: range.end.toISOString()
    }
  }
  if (periodValue === 'year') {
    const year = Number(yearValue) || new Date().getFullYear()
    const start = new Date(year, 0, 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(year, 11, 31, 23, 59, 59, 999)
    return {
      start: start.toISOString(),
      end: end.toISOString()
    }
  }
  return {}
}

const queryParams = computed(() => ({
  ...rangeQueryFor(period.value, selectedMonth.value, selectedYear.value, selectedDayInMonth.value, startDate.value, endDate.value),
  groupBy: groupBy.value,
  metric: metric.value,
  mode: mode.value,
  period: period.value,
  tenantIds: mode.value === 'custom' ? selectedTenantIds.value.join(',') : undefined,
  merchantIds: mode.value === 'custom' ? selectedMerchantIds.value.join(',') : undefined,
  branchIds: mode.value === 'custom' ? selectedBranchIds.value.join(',') : undefined,
  deviceTypes: selectedDeviceTypeCodes.value.join(',')
}))

const { data, pending, error } = await useFetch<ExplorerResponse>('/api/admin/dashboard/sales-explorer', {
  query: queryParams
})

const rows = computed(() => data.value?.rows || [])
const totals = computed(() => data.value?.totals || { revenue: 0, orders: 0, payments: 0 })
const timeline = computed(() => data.value?.timeline || { categories: [], series: [] as Array<{ id: string; name: string; data: number[] }> })
const deviceTypeTimeline = computed(() => data.value?.deviceTypeTimeline || { categories: [], series: [] as Array<{ id: string; name: string; data: number[] }> })
const deviceTypeOptions = computed(() => data.value?.deviceTypeOptions || [])

const chartSeries = computed(() => {
  const areaSeries = timeline.value.series.map(item => ({
    name: item.name,
    type: 'area' as const,
    data: item.data
  }))
  const includeDeviceType = metric.value === 'revenue' && selectedDeviceTypeCodes.value.length > 0
  if (!includeDeviceType) return areaSeries
  const lineSeries = deviceTypeTimeline.value.series.map(item => ({
    name: `Type: ${item.name}`,
    type: 'bar' as const,
    data: item.data
  }))
  return [...areaSeries, ...lineSeries]
})

const chartHeight = computed(() => {
  const n = Math.max(chartSeries.value.length, 1)
  return Math.min(520, Math.max(320, n * 36 + 200))
})

const chartOptions = computed<ApexOptions>(() => {
  const isDark = colorMode.value === 'dark'
  return {
    chart: {
      type: 'line',
      stacked: true,
      toolbar: { show: false },
      background: 'transparent',
      foreColor: isDark ? '#cbd5e1' : '#475569'
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '35%',
        borderRadius: 4
      }
    },
    fill: {
      type: chartSeries.value.map(() => 'solid'),
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.2,
        opacityTo: 0.2,
        stops: [0, 90, 100]
      },
      opacity: chartSeries.value.map(series => (series.type === 'area' ? 0.2 : 1))
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => Number(val).toLocaleString('en-US')
    },
    xaxis: {
      categories: timeline.value.categories,
      labels: {
        rotate: -30
      }
    },
    yaxis: {
      labels: {
        formatter: (val) => Number(val).toLocaleString('en-US')
      }
    },
    colors: ['#3b82f6', '#86efac', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6'],
    grid: {
      borderColor: isDark ? '#334155' : '#e2e8f0'
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    }
  }
})

function fmtNumber(value: number) {
  return Number(value || 0).toLocaleString('en-US')
}

const viewTitle = computed(() => {
  if (groupBy.value === 'tenant') return 'Compare by Tenant'
  if (groupBy.value === 'merchant') return 'Compare by Merchant'
  return 'Compare by Branch'
})

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

const rangeStartLabel = computed(() => formatDateOnly(data.value?.filters?.start))
const rangeEndLabel = computed(() => formatDateOnly(data.value?.filters?.end))
</script>

<template>
  <div class="space-y-6">
    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-[240px]">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Dashboard V2</p>
          <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Platform Sales Explorer</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Scope: All tenants</p>
        </div>

        <div class="flex flex-1 flex-wrap items-start justify-end gap-3">
          <div class="flex w-[140px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Group By</label>
            <select v-model="groupBy" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="tenant">Tenant</option>
              <option value="merchant">Merchant</option>
              <option value="branch">Branch</option>
            </select>
          </div>

          <div class="flex w-[140px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Metric</label>
            <select v-model="metric" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="revenue">Revenue</option>
              <option value="orders">Orders</option>
              <option value="payments">Payments</option>
            </select>
          </div>

          <div class="flex w-[120px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Mode</label>
            <select v-model="mode" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="all">All</option>
              <option value="top5">Top 5</option>
              <option value="top10">Top 10</option>
              <option value="custom">Custom</option>
            </select>

            <template v-if="period === 'custom'">
              <label class="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Start Date</label>
              <input v-model="startDate" type="date" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            </template>
          </div>

          <div class="flex w-[140px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Period</label>
            <select v-model="period" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Date Range</option>
            </select>

            <template v-if="period === 'day'">
              <label class="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Day</label>
              <select v-model.number="selectedDayInMonth" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <option v-for="dayNo in dayOptionsInSelectedMonth" :key="dayNo" :value="dayNo">Day {{ dayNo }}</option>
              </select>
            </template>

            <template v-if="period === 'custom'">
              <label class="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">End Date</label>
              <input v-model="endDate" type="date" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            </template>
          </div>

          <div v-if="period === 'day' || period === 'week' || period === 'month'" class="flex w-[140px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Month</label>
            <input v-model="selectedMonth" type="month" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          </div>

          <div v-if="period === 'year'" class="flex w-[120px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Year</label>
            <input v-model="selectedYear" type="number" min="2000" max="2100" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          </div>

          <div class="flex w-[180px] flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Device Type</label>
            <select v-model="selectedDeviceTypes" multiple class="h-28 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="__NONE__">None</option>
              <option v-for="item in deviceTypeOptions" :key="item.code" :value="item.code">
                {{ item.name }} ({{ item.code }})
              </option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="mode === 'custom'" class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div class="flex min-w-0 flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Tenant (multi)</label>
          <select v-model="selectedTenantIds" multiple class="h-28 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option v-for="item in tenantOptions" :key="item.id" :value="item.id">{{ item.code }} ({{ item.name }})</option>
          </select>
        </div>

        <div class="flex min-w-0 flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Merchant (multi)</label>
          <select v-model="selectedMerchantIds" multiple class="h-28 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option v-for="item in filteredMerchantOptions" :key="item.id" :value="item.id">{{ item.code }} ({{ item.name }})</option>
          </select>
        </div>

        <div class="flex min-w-0 flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Branch (multi)</label>
          <select v-model="selectedBranchIds" multiple class="h-28 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option v-for="item in filteredBranchOptions" :key="item.id" :value="item.id">{{ item.code }} ({{ item.name }})</option>
          </select>
        </div>
      </div>
    </UCard>

    <div class="grid gap-3 md:grid-cols-3">
      <UCard :ui="{ root: 'ring-1 ring-emerald-200/60 bg-emerald-50/40 dark:ring-emerald-900/50 dark:bg-emerald-950/20' }">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total Revenue</p>
        <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ fmtNumber(totals.revenue) }}</p>
      </UCard>
      <UCard :ui="{ root: 'ring-1 ring-blue-200/60 bg-blue-50/40 dark:ring-blue-900/50 dark:bg-blue-950/20' }">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total Orders</p>
        <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ fmtNumber(totals.orders) }}</p>
      </UCard>
      <UCard :ui="{ root: 'ring-1 ring-violet-200/60 bg-violet-50/40 dark:ring-violet-900/50 dark:bg-violet-950/20' }">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total Payments</p>
        <p class="text-2xl font-bold text-violet-600 dark:text-violet-400">{{ fmtNumber(totals.payments) }}</p>
      </UCard>
    </div>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ viewTitle }}</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Data range: {{ rangeStartLabel }} - {{ rangeEndLabel }}
          </p>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ rows.length }} items</p>
      </div>

      <div v-if="error" class="rounded-lg border border-rose-300/60 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
        {{ error.message }}
      </div>
      <div v-else-if="pending" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading chart...
      </div>
      <div v-else-if="!rows.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        No data in selected filters.
      </div>
      <div v-else>
        <ClientOnly>
          <ApexChart type="line" :height="chartHeight" :options="chartOptions" :series="chartSeries" />
        </ClientOnly>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700 dark:text-slate-300">
              <th class="px-3 py-2 font-medium">Entity</th>
              <th class="px-3 py-2 font-medium">Parent</th>
              <th class="px-3 py-2 font-medium text-right">Revenue</th>
              <th class="px-3 py-2 font-medium text-right">Orders</th>
              <th class="px-3 py-2 font-medium text-right">Payments</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id" class="border-b border-slate-100 dark:border-slate-800">
              <td class="px-3 py-2 text-slate-900 dark:text-slate-100">{{ item.label }}</td>
              <td class="px-3 py-2 text-slate-500 dark:text-slate-400">{{ item.parentLabel || '-' }}</td>
              <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{{ fmtNumber(item.amount) }}</td>
              <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{{ fmtNumber(item.orderCount) }}</td>
              <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{{ fmtNumber(item.paymentCount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
