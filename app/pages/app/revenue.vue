<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { ApexOptions } from 'apexcharts'

definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})

type PeriodPreset = 'day' | 'week' | 'month' | 'year' | 'custom'
type GroupBy = 'merchant' | 'branch'
type Metric = 'revenue' | 'orders' | 'payments'
type Mode = 'all' | 'top5' | 'top10' | 'custom'

type MerchantOption = { id: string; code: string; name: string }
type BranchOption = { id: string; code: string; name: string; merchantAccountId: string }
type DeviceTypeOption = { code: string; name: string }

type ExplorerResponse = {
  tenant?: { id: string; code: string; name: string } | null
  filters: {
    groupBy: GroupBy
    metric: Metric
    mode: Mode
    period: PeriodPreset
    start: string
    end: string
    merchantIds: string[]
    branchIds: string[]
  }
  options: {
    merchants: MerchantOption[]
    branches: BranchOption[]
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
  timeline?: {
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
type Totals = {
  revenue: number
  orders: number
  payments: number
}
type RevenueTrendsResponse = {
  daily: Array<{ key: string; label: string; amount: number }>
  monthly: Array<{ key: string; label: string; amount: number }>
}
type RevenueAssetUsageResponse = {
  filters: {
    period: PeriodPreset
    start: string
    end: string
  }
  categories: string[]
  series: Array<{
    name: string
    data: number[]
  }>
}

const ApexChart = defineAsyncComponent(async () => (await import('vue3-apexcharts')).default)
const colorMode = useColorMode()
const { data: authData } = useAuth()

const groupBy = ref<GroupBy>('merchant')
const metric = ref<Metric>('revenue')
const mode = ref<Mode>('all')
const period = ref<PeriodPreset>('month')
const startDate = ref('')
const endDate = ref('')
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const selectedYear = ref(String(new Date().getFullYear()))
const selectedDayInMonth = ref(new Date().getDate())
const selectedMerchantIds = ref<string[]>([])
const selectedBranchIds = ref<string[]>([])
const selectedDeviceTypes = ref<string[]>(['__NONE__'])
const selectedDeviceTypeCodes = computed(() => selectedDeviceTypes.value.filter(item => item !== '__NONE__'))
const roleKey = computed(() => String(authData.value?.user?.role || '').toUpperCase())
const isScopedRole = computed(() => roleKey.value === 'MANAGER' || roleKey.value === 'STAFF')

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
  merchantIds: mode.value === 'custom' && selectedMerchantIds.value.length ? selectedMerchantIds.value.join(',') : undefined,
  branchIds: mode.value === 'custom' && selectedBranchIds.value.length ? selectedBranchIds.value.join(',') : undefined,
  deviceTypes: selectedDeviceTypeCodes.value.length ? selectedDeviceTypeCodes.value.join(',') : undefined
}))

const { data, pending, error } = await useFetch<ExplorerResponse>('/api/app/dashboard-explorer', {
  query: queryParams
})
const trendQuery = computed(() => ({
  mode: mode.value === 'custom' ? 'custom' : 'all',
  merchantIds: mode.value === 'custom' && selectedMerchantIds.value.length ? selectedMerchantIds.value.join(',') : undefined,
  branchIds: mode.value === 'custom' && selectedBranchIds.value.length ? selectedBranchIds.value.join(',') : undefined
}))
const { data: trendsData, pending: trendsPending } = await useFetch<RevenueTrendsResponse>('/api/app/revenue-trends', {
  query: trendQuery
})
const { data: summaryData } = await useFetch<{
  tenant?: { id: string; code: string; name: string } | null
}>('/api/app/dashboard')
const assetUsageQuery = computed(() => ({
  ...rangeQueryFor(period.value, selectedMonth.value, selectedYear.value, selectedDayInMonth.value, startDate.value, endDate.value),
  mode: mode.value,
  period: period.value,
  merchantIds: mode.value === 'custom' && selectedMerchantIds.value.length ? selectedMerchantIds.value.join(',') : undefined,
  branchIds: mode.value === 'custom' && selectedBranchIds.value.length ? selectedBranchIds.value.join(',') : undefined
}))
const { data: assetUsageData, pending: assetUsagePending } = await useFetch<RevenueAssetUsageResponse>('/api/app/revenue-asset-usage', {
  query: assetUsageQuery
})

const rows = computed(() => data.value?.rows || [])
const timeline = computed(() => data.value?.timeline || { categories: [] as string[], series: [] as Array<{ id: string; name: string; data: number[] }> })
const deviceTypeTimeline = computed(() => data.value?.deviceTypeTimeline || { categories: [] as string[], series: [] as Array<{ id: string; name: string; data: number[] }> })
const deviceTypeOptions = computed(() => data.value?.deviceTypeOptions || [])
const totals = computed<Totals>(() => data.value?.totals || { revenue: 0, orders: 0, payments: 0 })
const tenantName = computed(() => data.value?.tenant?.name || summaryData.value?.tenant?.name || '-')
const tenantCode = computed(() => data.value?.tenant?.code || summaryData.value?.tenant?.code || '-')

const merchants = computed(() => data.value?.options?.merchants || [])
const branches = computed(() => data.value?.options?.branches || [])
const isBranchScopedGroupBy = computed(() => isScopedRole.value && branches.value.length <= 1)

const filteredBranches = computed(() => {
  const merchantSet = new Set(selectedMerchantIds.value)
  if (!merchantSet.size) return branches.value
  return branches.value.filter(item => merchantSet.has(item.merchantAccountId))
})

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  return a.every((id, index) => id === b[index])
}

watch(filteredBranches, (items) => {
  const allowed = new Set(items.map(item => item.id))
  const next = selectedBranchIds.value.filter(id => allowed.has(id))
  if (!sameIds(next, selectedBranchIds.value)) {
    selectedBranchIds.value = next
  }
}, { immediate: true })

watch([merchants, branches, mode, isScopedRole], () => {
  if (!isScopedRole.value) return
  if (mode.value !== 'custom') return

  const merchantIds = merchants.value.map(item => item.id)
  if (!sameIds(merchantIds, selectedMerchantIds.value)) {
    selectedMerchantIds.value = merchantIds
  }

  const allowedBranchSet = new Set(branches.value
    .filter(item => !merchantIds.length || merchantIds.includes(item.merchantAccountId))
    .map(item => item.id))
  const scopedBranchIds = branches.value.filter(item => allowedBranchSet.has(item.id)).map(item => item.id)
  if (!sameIds(scopedBranchIds, selectedBranchIds.value)) {
    selectedBranchIds.value = scopedBranchIds
  }
}, { immediate: true })

watch(isBranchScopedGroupBy, (locked) => {
  if (locked && groupBy.value !== 'branch') groupBy.value = 'branch'
}, { immediate: true })

const chartSeries = computed(() => [
  ...timeline.value.series.map((item) => ({
    name: item.name,
    type: 'area' as const,
    data: item.data
  })),
  ...(selectedDeviceTypeCodes.value.length ? deviceTypeTimeline.value.series.map((item) => ({
    name: `Type: ${item.name}`,
    type: 'bar' as const,
    data: item.data
  })) : [])
])

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
      width: chartSeries.value.map((series) => (series.type === 'area' ? 3 : 0))
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '35%',
        borderRadius: 4
      }
    },
    dataLabels: {
      enabled: false
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
    colors: ['#3b82f6', '#86efac', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'],
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
  if (groupBy.value === 'merchant') return 'Revenue by Merchant'
  return 'Revenue by Branch'
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
const dailyTrend = computed(() => trendsData.value?.daily || [])
const monthlyTrend = computed(() => trendsData.value?.monthly || [])

const wowTotals = ref<Totals>({ revenue: 0, orders: 0, payments: 0 })
const momTotals = ref<Totals>({ revenue: 0, orders: 0, payments: 0 })
const yoyTotals = ref<Totals>({ revenue: 0, orders: 0, payments: 0 })
const compareLoading = ref(false)

function shiftedDates(start: Date, end: Date, mode: 'week' | 'month' | 'year') {
  const s = new Date(start)
  const e = new Date(end)
  if (mode === 'week') {
    s.setDate(s.getDate() - 7)
    e.setDate(e.getDate() - 7)
    return { start: s, end: e }
  }
  if (mode === 'month') {
    s.setMonth(s.getMonth() - 1)
    e.setMonth(e.getMonth() - 1)
    return { start: s, end: e }
  }
  s.setFullYear(s.getFullYear() - 1)
  e.setFullYear(e.getFullYear() - 1)
  return { start: s, end: e }
}

function changePercent(current: number, previous: number) {
  if (!previous && !current) return '0.0%'
  if (!previous) return '+100.0%'
  const diff = ((current - previous) / previous) * 100
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff.toFixed(1)}%`
}

const wowRevenuePct = computed(() => changePercent(totals.value.revenue, wowTotals.value.revenue))
const momRevenuePct = computed(() => changePercent(totals.value.revenue, momTotals.value.revenue))
const yoyRevenuePct = computed(() => changePercent(totals.value.revenue, yoyTotals.value.revenue))

function deltaTextClass(delta: string) {
  if (delta.startsWith('+')) return 'text-emerald-600 dark:text-emerald-400'
  if (delta.startsWith('-')) return 'text-rose-600 dark:text-rose-400'
  return 'text-slate-900 dark:text-slate-100'
}

const monthCompare = computed(() => {
  const endBase = data.value?.filters?.end ? new Date(data.value.filters.end) : new Date()
  const y = endBase.getFullYear()
  const m = endBase.getMonth()
  const currentStart = new Date(y, m, 1)
  const currentEnd = new Date(y, m + 1, 0, 23, 59, 59, 999)
  const previousStart = new Date(y, m - 1, 1)
  const previousEnd = new Date(y, m, 0, 23, 59, 59, 999)
  const currentDays = currentEnd.getDate()

  const currentMap = new Map<number, number>()
  const previousMap = new Map<number, number>()

  for (const item of dailyTrend.value) {
    const d = new Date(item.key)
    if (Number.isNaN(d.getTime())) continue
    if (d >= currentStart && d <= currentEnd) {
      currentMap.set(d.getDate(), Number(item.amount || 0))
    } else if (d >= previousStart && d <= previousEnd) {
      previousMap.set(d.getDate(), Number(item.amount || 0))
    }
  }

  const labels = Array.from({ length: currentDays }, (_, i) => String(i + 1))
  const currentData = labels.map((day) => Number(currentMap.get(Number(day)) || 0))
  const previousData = labels.map((day) => {
    const dayNo = Number(day)
    if (dayNo > previousEnd.getDate()) return null
    return Number(previousMap.get(dayNo) || 0)
  })

  return {
    labels,
    currentData,
    previousData,
    currentLabel: currentStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    previousLabel: previousStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
})

const monthCompareSeries = computed(() => [
  {
    name: monthCompare.value.currentLabel,
    type: 'area' as const,
    data: monthCompare.value.currentData
  },
  {
    name: monthCompare.value.previousLabel,
    type: 'line' as const,
    data: monthCompare.value.previousData
  }
])

const yearCompare = computed(() => {
  const endBase = data.value?.filters?.end ? new Date(data.value.filters.end) : new Date()
  const currentYear = endBase.getFullYear()
  const previousYear = currentYear - 1
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const monthMap = new Map(monthlyTrend.value.map(item => [item.key, Number(item.amount || 0)]))
  const currentData = labels.map((_, idx) => {
    const key = `${currentYear}-${String(idx + 1).padStart(2, '0')}`
    return Number(monthMap.get(key) || 0)
  })
  const previousData = labels.map((_, idx) => {
    const key = `${previousYear}-${String(idx + 1).padStart(2, '0')}`
    return Number(monthMap.get(key) || 0)
  })

  return {
    labels,
    currentData,
    previousData,
    currentLabel: String(currentYear),
    previousLabel: String(previousYear)
  }
})

const yearCompareSeries = computed(() => [
  {
    name: yearCompare.value.currentLabel,
    type: 'area' as const,
    data: yearCompare.value.currentData
  },
  {
    name: yearCompare.value.previousLabel,
    type: 'line' as const,
    data: yearCompare.value.previousData
  }
])

const monthCompareOptions = computed<ApexOptions>(() => {
  const isDark = colorMode.value === 'dark'
  return {
    chart: {
      type: 'line',
      toolbar: { show: false },
      background: 'transparent',
      foreColor: isDark ? '#cbd5e1' : '#475569'
    },
    stroke: {
      width: [2, 3],
      curve: 'smooth'
    },
    markers: {
      size: 0
    },
    xaxis: {
      categories: monthCompare.value.labels,
      labels: {
        show: true
      }
    },
    yaxis: {
      labels: {
        formatter: (val) => Number(val).toLocaleString('en-US')
      }
    },
    colors: ['#3b82f6', '#22c55e'],
    fill: {
      type: ['gradient', 'solid'],
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.6,
        opacityTo: 0.25
      }
    },
    grid: {
      borderColor: isDark ? '#334155' : '#e2e8f0'
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    }
  }
})

const yearCompareOptions = computed<ApexOptions>(() => {
  const isDark = colorMode.value === 'dark'
  return {
    chart: {
      type: 'line',
      toolbar: { show: false },
      background: 'transparent',
      foreColor: isDark ? '#cbd5e1' : '#475569'
    },
    stroke: {
      width: [2, 3],
      curve: 'smooth'
    },
    fill: {
      type: ['gradient', 'solid'],
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.6,
        opacityTo: 0.25
      }
    },
    markers: {
      size: 0
    },
    xaxis: {
      categories: yearCompare.value.labels
    },
    yaxis: {
      labels: {
        formatter: (val) => Number(val).toLocaleString('en-US')
      }
    },
    colors: ['#a855f7', '#22c55e'],
    grid: {
      borderColor: isDark ? '#334155' : '#e2e8f0'
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    }
  }
})

const assetUsageChartOptions = computed<ApexOptions>(() => {
  const isDark = colorMode.value === 'dark'
  return {
    chart: {
      type: 'line',
      stacked: false,
      toolbar: { show: false },
      background: 'transparent',
      foreColor: isDark ? '#cbd5e1' : '#475569'
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '48%',
        borderRadius: 4
      }
    },
    stroke: {
      width: [0, 3],
      curve: 'smooth'
    },
    markers: {
      size: [0, 4]
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: assetUsageData.value?.categories || []
    },
    yaxis: [
      {
        title: { text: 'Used Count' },
        labels: {
          formatter: (val) => Number(val).toLocaleString('en-US')
        }
      },
      {
        opposite: true,
        title: { text: 'Revenue' },
        labels: {
          formatter: (val) => Number(val).toLocaleString('en-US')
        }
      }
    ],
    colors: ['#2563eb', '#f97316'],
    legend: {
      position: 'top'
    },
    grid: {
      borderColor: isDark ? '#334155' : '#e2e8f0'
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    }
  }
})

const compareKey = computed(() => [
  data.value?.filters?.start || '',
  data.value?.filters?.end || '',
  groupBy.value,
  metric.value,
  mode.value,
  selectedMerchantIds.value.join(','),
  selectedBranchIds.value.join(','),
  selectedDeviceTypeCodes.value.join(',')
].join('|'))

watch(compareKey, async () => {
  const startRaw = data.value?.filters?.start
  const endRaw = data.value?.filters?.end
  if (!startRaw || !endRaw) return
  const start = new Date(startRaw)
  const end = new Date(endRaw)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return

  const common = {
    groupBy: groupBy.value,
    metric: metric.value,
    mode: mode.value,
    merchantIds: mode.value === 'custom' && selectedMerchantIds.value.length ? selectedMerchantIds.value.join(',') : undefined,
    branchIds: mode.value === 'custom' && selectedBranchIds.value.length ? selectedBranchIds.value.join(',') : undefined
  }

  const wow = shiftedDates(start, end, 'week')
  const mom = shiftedDates(start, end, 'month')
  const yoy = shiftedDates(start, end, 'year')

  compareLoading.value = true
  try {
    const [wowRes, momRes, yoyRes] = await Promise.all([
      $fetch<ExplorerResponse>('/api/app/dashboard-explorer', {
        query: { ...common, period: 'custom', start: wow.start.toISOString(), end: wow.end.toISOString() }
      }),
      $fetch<ExplorerResponse>('/api/app/dashboard-explorer', {
        query: { ...common, period: 'custom', start: mom.start.toISOString(), end: mom.end.toISOString() }
      }),
      $fetch<ExplorerResponse>('/api/app/dashboard-explorer', {
        query: { ...common, period: 'custom', start: yoy.start.toISOString(), end: yoy.end.toISOString() }
      })
    ])
    wowTotals.value = wowRes.totals || { revenue: 0, orders: 0, payments: 0 }
    momTotals.value = momRes.totals || { revenue: 0, orders: 0, payments: 0 }
    yoyTotals.value = yoyRes.totals || { revenue: 0, orders: 0, payments: 0 }
  } catch {
    wowTotals.value = { revenue: 0, orders: 0, payments: 0 }
    momTotals.value = { revenue: 0, orders: 0, payments: 0 }
    yoyTotals.value = { revenue: 0, orders: 0, payments: 0 }
  } finally {
    compareLoading.value = false
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Revenue</p>
        <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ tenantName }}</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Tenant: {{ tenantCode }} ({{ tenantName }})</p>
      </div>

      <div class="flex flex-1 flex-wrap items-start justify-end gap-3">
        <div class="flex w-[140px] flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Group By</label>
          <select v-model="groupBy" :disabled="isBranchScopedGroupBy" class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option v-if="!isBranchScopedGroupBy" value="merchant">Merchant</option>
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

    <div v-if="mode === 'custom'" class="rounded-lg border border-slate-200 bg-white/95 p-3 dark:border-slate-700 dark:bg-slate-900/90">
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div class="flex min-w-0 flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Merchant (multi)</label>
          <select v-model="selectedMerchantIds" :disabled="isScopedRole" multiple class="h-28 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.code }} ({{ item.name }})</option>
          </select>
        </div>

        <div class="flex min-w-0 flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Branch (multi)</label>
          <select v-model="selectedBranchIds" :disabled="isScopedRole" multiple class="h-28 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option v-for="item in filteredBranches" :key="item.id" :value="item.id">{{ item.code }} ({{ item.name }})</option>
          </select>
        </div>
      </div>
      <p v-if="isScopedRole" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Merchant/Branch are fixed by your scope.
      </p>
    </div>

    <UCard :ui="{ root: 'ring-1 ring-slate-200 bg-white dark:ring-slate-700 dark:bg-slate-900' }">
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Revenue Summary</p>
      </div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div class="flex min-h-[92px] flex-col items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
          <p class="text-sm text-slate-600 dark:text-slate-300">Total Revenue</p>
          <p class="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{{ fmtNumber(totals.revenue) }}</p>
        </div>
        <div class="flex min-h-[92px] flex-col items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
          <p class="text-sm text-slate-600 dark:text-slate-300">Total Orders</p>
          <p class="text-lg font-semibold text-blue-600 dark:text-blue-400">{{ fmtNumber(totals.orders) }}</p>
        </div>
        <div class="flex min-h-[92px] flex-col items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
          <p class="text-sm text-slate-600 dark:text-slate-300">Total Payments</p>
          <p class="text-lg font-semibold text-violet-600 dark:text-violet-400">{{ fmtNumber(totals.payments) }}</p>
        </div>
      </div>
    </UCard>

    <UCard class="w-full xl:w-2/3" :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ viewTitle }}</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Data range: {{ rangeStartLabel }} - {{ rangeEndLabel }}
          </p>
        </div>
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

    <UCard class="w-full xl:w-2/3" :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="mb-2 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Asset Used & Revenue by Usage</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Combo chart (Used = bar, Revenue = line)</p>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ (assetUsageData?.categories || []).length }} assets</p>
      </div>
      <div v-if="assetUsagePending" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading asset usage...</div>
      <div v-else-if="!(assetUsageData?.categories || []).length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No asset usage data.</div>
      <ClientOnly v-else>
        <ApexChart
          type="line"
          height="320"
          :options="assetUsageChartOptions"
          :series="[
            { name: assetUsageData?.series?.[0]?.name || 'Asset Used', type: 'bar', data: assetUsageData?.series?.[0]?.data || [] },
            { name: assetUsageData?.series?.[1]?.name || 'Revenue by Usage', type: 'line', data: assetUsageData?.series?.[1]?.data || [] }
          ]"
        />
      </ClientOnly>
    </UCard>

    <UCard :ui="{ root: 'ring-1 ring-slate-200 bg-white dark:ring-slate-700 dark:bg-slate-900' }">
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Comparison Summary</p>
      </div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div class="flex min-h-[92px] flex-col items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
          <p class="text-sm text-slate-600 dark:text-slate-300">WoW</p>
          <p class="text-lg font-semibold" :class="deltaTextClass(wowRevenuePct)">{{ wowRevenuePct }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Prev: {{ fmtNumber(wowTotals.revenue) }}</p>
        </div>
        <div class="flex min-h-[92px] flex-col items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
          <p class="text-sm text-slate-600 dark:text-slate-300">MoM</p>
          <p class="text-lg font-semibold" :class="deltaTextClass(momRevenuePct)">{{ momRevenuePct }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Prev: {{ fmtNumber(momTotals.revenue) }}</p>
        </div>
        <div class="flex min-h-[92px] flex-col items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
          <p class="text-sm text-slate-600 dark:text-slate-300">YoY</p>
          <p class="text-lg font-semibold" :class="deltaTextClass(yoyRevenuePct)">{{ yoyRevenuePct }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Prev: {{ fmtNumber(yoyTotals.revenue) }}</p>
        </div>
      </div>
      <p v-if="compareLoading" class="mt-2 text-xs text-slate-500 dark:text-slate-400">Updating WoW/MoM/YoY...</p>
    </UCard>


    <div class="grid gap-3 lg:grid-cols-2">
      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">DoD Compare (This Month vs Last Month)</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Area + Line</p>
        </div>
        <div v-if="trendsPending" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading trend...</div>
        <div v-else-if="!monthCompare.labels.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No month-compare data.</div>
        <ClientOnly v-else>
          <ApexChart type="line" height="260" :options="monthCompareOptions" :series="monthCompareSeries" />
        </ClientOnly>
      </UCard>

      <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">MoM Compare (This Year vs Last Year)</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Area + Line</p>
        </div>
        <div v-if="trendsPending" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading trend...</div>
        <div v-else-if="!yearCompare.labels.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No yearly compare data.</div>
        <ClientOnly v-else>
          <ApexChart type="line" height="260" :options="yearCompareOptions" :series="yearCompareSeries" />
        </ClientOnly>
      </UCard>
    </div>


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
