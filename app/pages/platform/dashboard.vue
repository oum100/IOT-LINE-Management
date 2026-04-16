<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { ApexOptions } from 'apexcharts'

definePageMeta({
  layout: 'admin',
  middleware: 'portal-auth'
})

type TenantOption = {
  id: string
  code: string
  name: string
}

type DashboardCard = {
  key: string
  title: string
  total: number
  statuses: Array<{ label: string; count: number }>
}
type CardChartType = 'donut' | 'bar' | 'polarArea'

type DashboardResponse = {
  sales: {
    totalAmount: number
    byTenant: Array<{
      tenantId: string
      tenantCode: string
      tenantName: string
      amount: number
      orderCount: number
    }>
  }
  cards: DashboardCard[]
}

type PeriodPreset = '24h' | 'week' | 'month' | 'year' | 'custom'
type ChartMode = 'top5' | 'top10' | 'custom'

const chartMode = ref<ChartMode>('top5')
const period = ref<PeriodPreset>('month')
const startDate = ref('')
const endDate = ref('')
const selectedTenantIds = ref<string[]>([])
const colorMode = useColorMode()
const ApexChart = defineAsyncComponent(async () => (await import('vue3-apexcharts')).default)
const chartPalette = ['#3b82f6', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#8b5cf6', '#ec4899']
const statusPalette = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#eab308', '#8b5cf6']

const { data: tenantListData } = await useFetch<{ items: TenantOption[] }>('/api/admin/tenants')
const tenantOptions = computed(() => tenantListData.value?.items || [])

watch(
  tenantOptions,
  (items) => {
    if (!items.length) return
    if (selectedTenantIds.value.length) return
    selectedTenantIds.value = items.map(item => item.id)
  },
  { immediate: true }
)

const queryParams = computed(() => ({
  top:
    chartMode.value === 'top5'
      ? 5
      : chartMode.value === 'top10'
        ? 10
        : Math.max(selectedTenantIds.value.length, 1),
  period: period.value,
  start: period.value === 'custom' ? startDate.value : undefined,
  end: period.value === 'custom' ? endDate.value : undefined,
  tenantIds: chartMode.value === 'custom' ? selectedTenantIds.value.join(',') : undefined
}))

const { data, pending, error, refresh } = await useFetch<DashboardResponse>('/api/admin/dashboard/overview', {
  query: queryParams
})

const salesRows = computed(() => data.value?.sales.byTenant || [])
const totalSales = computed(() => Number(data.value?.sales.totalAmount || 0))
const cards = computed(() => data.value?.cards || [])
const salesChartHeight = computed(() => {
  const rows = Math.max(salesRows.value.length, 1)
  const dynamic = rows * 32 + 100
  return Math.min(440, Math.max(240, dynamic))
})

const cardByKey = computed(() => {
  const map = new Map<string, DashboardCard>()
  for (const card of cards.value) map.set(card.key, card)
  return map
})

const coreCards = computed(() =>
  cards.value.filter(card => ['tenants', 'merchants', 'branches'].includes(card.key))
)

const cardsWithoutCore = computed(() =>
  cards.value.filter(card => !['tenants', 'merchants', 'branches'].includes(card.key))
)

function cardChartType(index: number): CardChartType {
  const types: CardChartType[] = ['donut', 'bar', 'polarArea']
  return types[index % types.length]!
}

function statusColors(size: number) {
  return Array.from({ length: size }, (_, i) => statusPalette[i % statusPalette.length]!)
}

function cardSeriesData(card: DashboardCard) {
  return card.statuses.filter(item => item.count > 0).map(item => item.count)
}

function cardLabels(card: DashboardCard) {
  const filtered = card.statuses.filter(item => item.count > 0)
  return (filtered.length ? filtered : card.statuses).map(item => item.label)
}

function cardSeries(card: DashboardCard, chartType: CardChartType) {
  const values = cardSeriesData(card)
  if (chartType === 'bar') {
    return [
      {
        name: card.title,
        data: values
      }
    ]
  }
  return values
}

function cardChartOptions(card: DashboardCard, chartType: CardChartType): ApexOptions {
  const isDark = colorMode.value === 'dark'
  const labels = cardLabels(card)
  const colors = statusColors(labels.length)

  if (chartType === 'bar') {
    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        background: 'transparent',
        foreColor: isDark ? '#cbd5e1' : '#475569'
      },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 4,
          barHeight: '55%',
          distributed: true
        }
      },
      dataLabels: {
        enabled: true
      },
      xaxis: {
        categories: labels,
        labels: { show: true }
      },
      yaxis: {
        labels: { maxWidth: 120 }
      },
      grid: {
        borderColor: isDark ? '#334155' : '#e2e8f0'
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light'
      },
      colors
    }
  }

  return {
    chart: {
      type: chartType,
      toolbar: { show: false },
      background: 'transparent',
      foreColor: isDark ? '#cbd5e1' : '#475569'
    },
    labels,
    legend: {
      position: 'bottom',
      fontSize: '11px',
      labels: {
        colors: isDark ? '#cbd5e1' : '#475569'
      }
    },
    stroke: {
      colors: [isDark ? '#0f172a' : '#ffffff']
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    },
    colors
  }
}

const chartSeries = computed(() => [
  {
    name: 'Sales',
    data: salesRows.value.map(item => item.amount)
  }
])

const chartOptions = computed<ApexOptions>(() => {
  const isDark = colorMode.value === 'dark'
  return {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
      foreColor: isDark ? '#cbd5e1' : '#475569'
    },
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        borderRadius: 6,
        barHeight: '60%'
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => Number(val).toLocaleString('th-TH')
    },
    xaxis: {
      categories: salesRows.value.map(item => `${item.tenantName} (${item.tenantCode})`),
      labels: {
        formatter: (val) => Number(val).toLocaleString('th-TH')
      }
    },
    yaxis: {
      labels: {
        maxWidth: 240
      }
    },
    grid: {
      borderColor: isDark ? '#334155' : '#e2e8f0'
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val) => `${Number(val).toLocaleString('th-TH')} บาท`
      }
    },
    colors: salesRows.value.map((_, index) => chartPalette[index % chartPalette.length])
  }
})

function formatMoney(value: number) {
  return value.toLocaleString('th-TH')
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Dashboard</p>
      <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Platform Sales & Status Overview</h2>
    </div>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">ยอดขายรวม (Multi-Tenant)</h3>
          <div class="flex flex-wrap items-center gap-2">
            <select v-model="chartMode" class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="top5">Top-5</option>
              <option value="top10">Top-10</option>
              <option value="custom">Custom</option>
            </select>
            <select v-model="period" class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="24h">24h</option>
              <option value="week">1 week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Date Range</option>
            </select>
            <input
              v-model="startDate"
              type="date"
              :disabled="period !== 'custom'"
              class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
            >
            <input
              v-model="endDate"
              type="date"
              :disabled="period !== 'custom'"
              class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
            >
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="pending"
              @click="() => refresh()"
            >
              Refresh
            </UButton>
          </div>
        </div>
      </template>

      <div class="grid gap-4" :class="chartMode === 'custom' ? 'lg:grid-cols-[260px_1fr]' : 'grid-cols-1'">
        <div v-if="chartMode === 'custom'" class="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label v-if="chartMode === 'custom'" class="block text-xs text-slate-500 dark:text-slate-400">
            Tenants in Chart (Custom)
            <select
              v-model="selectedTenantIds"
              multiple
              size="12"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option v-for="item in tenantOptions" :key="item.id" :value="item.id">
                {{ item.name }} ({{ item.code }})
              </option>
            </select>
          </label>
          <p v-if="chartMode === 'custom'" class="text-xs text-slate-500 dark:text-slate-400">Tip: กด `Ctrl/Cmd` เพื่อเลือกหลาย tenant</p>
        </div>

        <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div class="mb-4 flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Sales</p>
            <p class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{{ formatMoney(totalSales) }}</p>
          </div>

          <div v-if="error" class="rounded-lg border border-rose-300/60 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
            {{ error.message }}
          </div>
          <div v-else-if="pending" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading sales chart...
          </div>
          <div v-else-if="!salesRows.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No sales data in selected filters.
          </div>
          <div v-else>
            <ClientOnly>
            <ApexChart
              type="bar"
              :height="salesChartHeight"
              :options="chartOptions"
              :series="chartSeries"
            />
            </ClientOnly>
          </div>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">จำนวนรวมและสถานะตามตารางข้อมูล</h3>
      </template>

      <div v-if="pending && !cards.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading status cards...
      </div>
      <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="core in coreCards"
          :key="core.key"
          class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ core.title }}</p>
            <p class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ core.total }}</p>
          </div>
          <div v-if="core.statuses.length" class="mt-3">
            <ClientOnly>
              <ApexChart
                type="donut"
                height="180"
                :options="cardChartOptions(core, 'donut')"
                :series="cardSeries(core, 'donut')"
              />
            </ClientOnly>
          </div>
        </div>

        <div
          v-for="(card, index) in cardsWithoutCore"
          :key="card.key"
          class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ card.title }}</p>
            <p class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ card.total }}</p>
          </div>
          <div v-if="card.statuses.length" class="mt-3">
            <ClientOnly>
              <template #fallback>
                <div class="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Rendering chart...</div>
              </template>
              <ApexChart
                :type="cardChartType(index)"
                height="180"
                :options="cardChartOptions(card, cardChartType(index))"
                :series="cardSeries(card, cardChartType(index))"
              />
            </ClientOnly>
          </div>
          <div
            v-if="!cardSeriesData(card).length"
            class="mt-2 text-xs text-slate-500 dark:text-slate-400"
          >
            No status data
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
