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
type CardChartType = 'donut' | 'pie' | 'bar' | 'polarArea'

type AlertLevel = 'critical' | 'high' | 'medium' | 'low'

type DashboardAlert = {
  id: string
  level: AlertLevel
  title: string
  summary: string
  count: number
  link: string
  linkLabel: string
}

type DashboardOverviewResponse = {
  filters: {
    top: number
    period: PeriodPreset
    start: string
    end: string
    tenantIds: string[]
  }
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
}

type DashboardCardsResponse = {
  filters: {
    period: PeriodPreset
    start: string
    end: string
    tenantIds: string[]
  }
  cards: DashboardCard[]
}

type PeriodPreset = '24h' | 'week' | 'month' | 'year' | 'custom'
type ChartMode = 'top5' | 'top10' | 'custom'

const chartMode = ref<ChartMode>('top5')
const period = ref<PeriodPreset>('month')
const startDate = ref('')
const endDate = ref('')
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const selectedWeekOfMonth = ref(1)
const selectedTenantIds = ref<string[]>([])

const cardsTenantMode = ref<'all' | 'custom'>('all')
const cardsPeriod = ref<PeriodPreset>('month')
const cardsStartDate = ref('')
const cardsEndDate = ref('')
const cardsSelectedMonth = ref(new Date().toISOString().slice(0, 7))
const cardsSelectedWeekOfMonth = ref(1)
const cardsSelectedTenantIds = ref<string[]>([])
const colorMode = useColorMode()
const { getLocale } = useI18n()
const ApexChart = defineAsyncComponent(async () => (await import('vue3-apexcharts')).default)
const chartPalette = ['#3b82f6', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#8b5cf6', '#ec4899']
const isThai = computed(() => String(getLocale?.() || '').toLowerCase().startsWith('th'))
const numberLocale = computed(() => (isThai.value ? 'th-TH' : 'en-US'))

function tx(th: string, en: string) {
  return isThai.value ? th : en
}

const { data: tenantListData } = await useFetch<{ items: TenantOption[] }>('/api/admin/tenants')
const tenantOptions = computed(() => tenantListData.value?.items || [])

watch(
  tenantOptions,
  (items) => {
    if (!items.length) return
    if (!selectedTenantIds.value.length) {
      selectedTenantIds.value = items.map(item => item.id)
    }
    if (!cardsSelectedTenantIds.value.length) {
      cardsSelectedTenantIds.value = items.map(item => item.id)
    }
  },
  { immediate: true }
)

function monthStartEnd(monthValue: string) {
  const [yearRaw, monthRaw] = monthValue.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const start = new Date(year, month - 1, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

function weeksInMonth(monthValue: string) {
  if (!monthValue || !monthValue.includes('-')) return 4
  const { start, end } = monthStartEnd(monthValue)
  const firstWeekStart = new Date(start)
  firstWeekStart.setDate(start.getDate() - start.getDay())
  firstWeekStart.setHours(0, 0, 0, 0)

  let count = 0
  const cursor = new Date(firstWeekStart)
  while (cursor <= end) {
    count += 1
    cursor.setDate(cursor.getDate() + 7)
  }
  return Math.max(1, count)
}

function weekRangeInMonth(monthValue: string, weekNo: number) {
  const { start } = monthStartEnd(monthValue)
  const firstWeekStart = new Date(start)
  firstWeekStart.setDate(start.getDate() - start.getDay())
  firstWeekStart.setHours(0, 0, 0, 0)

  const weekStart = new Date(firstWeekStart)
  weekStart.setDate(firstWeekStart.getDate() + (Math.max(1, weekNo) - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return { start: weekStart, end: weekEnd }
}

const weekOptions = computed(() => {
  const total = weeksInMonth(selectedMonth.value)
  return Array.from({ length: total }, (_, i) => i + 1)
})

watch(weekOptions, (options) => {
  if (!options.includes(selectedWeekOfMonth.value)) {
    selectedWeekOfMonth.value = options[0] || 1
  }
}, { immediate: true })

const cardsWeekOptions = computed(() => {
  const total = weeksInMonth(cardsSelectedMonth.value)
  return Array.from({ length: total }, (_, i) => i + 1)
})

watch(cardsWeekOptions, (options) => {
  if (!options.includes(cardsSelectedWeekOfMonth.value)) {
    cardsSelectedWeekOfMonth.value = options[0] || 1
  }
}, { immediate: true })

function rangeQueryFor(periodValue: PeriodPreset, monthValue: string, weekValue: number, customStart: string, customEnd: string) {
  if (periodValue === 'custom') {
    return {
      start: customStart || undefined,
      end: customEnd || undefined
    }
  }
  if (periodValue === 'month') {
    const range = monthStartEnd(monthValue)
    return {
      start: range.start.toISOString(),
      end: range.end.toISOString()
    }
  }
  if (periodValue === 'week') {
    const range = weekRangeInMonth(monthValue, weekValue)
    return {
      start: range.start.toISOString(),
      end: range.end.toISOString()
    }
  }
  return {}
}

const queryParams = computed(() => ({
  ...rangeQueryFor(period.value, selectedMonth.value, selectedWeekOfMonth.value, startDate.value, endDate.value),
  top:
    chartMode.value === 'top5'
      ? 5
      : chartMode.value === 'top10'
        ? 10
        : Math.max(selectedTenantIds.value.length, 1),
  period: period.value,
  tenantIds: chartMode.value === 'custom' ? selectedTenantIds.value.join(',') : undefined
}))

const cardQueryParams = computed(() => ({
  ...rangeQueryFor(cardsPeriod.value, cardsSelectedMonth.value, cardsSelectedWeekOfMonth.value, cardsStartDate.value, cardsEndDate.value),
  period: cardsPeriod.value,
  tenantIds: cardsTenantMode.value === 'custom' ? cardsSelectedTenantIds.value.join(',') : undefined
}))

const { data, pending, error, refresh } = await useFetch<DashboardOverviewResponse>('/api/admin/dashboard/overview', {
  query: queryParams
})

const { data: cardsData, pending: cardsPending, error: cardsError, refresh: refreshCards } = await useFetch<DashboardCardsResponse>('/api/admin/dashboard/cards', {
  query: cardQueryParams
})

const salesRows = computed(() => data.value?.sales.byTenant || [])
const totalSales = computed(() => Number(data.value?.sales.totalAmount || 0))
const cards = computed(() => cardsData.value?.cards || [])

const statusLabel = (value: string) => String(value || '').toUpperCase().trim()
function matchStatus(label: string, keys: string[]) {
  const normalized = statusLabel(label)
  const normalizedSet = keys.map(statusLabel)
  return normalizedSet.some(key => normalized === key || normalized.endsWith(`_${key}`) || normalized.includes(key))
}

function findCard(key: string) {
  return cardByKey.value.get(key)
}

function sumCardStatus(cardKey: string, keys: string[]) {
  const card = findCard(cardKey)
  if (!card) return 0
  return card.statuses
    .filter(item => matchStatus(item.label, keys))
    .reduce((sum, item) => sum + item.count, 0)
}

const cardsAlertSummary = computed(() => {
  const alerts: DashboardAlert[] = []

  const waitingOrders = sumCardStatus('orders', ['WAIT_FOR_PAY', 'WAITING_PAYMENT', 'PENDING_PAYMENT', 'AWAITING_PAYMENT', 'PENDING'])
  const runningOrders = sumCardStatus('orders', ['RUNNING', 'SERVICE_RUNNING', 'IN_PROGRESS', 'PROCESSING', 'RESERVED'])
  const failedOrders = sumCardStatus('orders', ['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED'])

  const failedPayments = sumCardStatus('payments', ['FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED'])
  const disputedPayments = sumCardStatus('payments', ['RECONCILIATION_MISMATCH', 'FAILED', 'PENDING'])

  const tenantSuspended = sumCardStatus('tenants', ['SUSPENDED', 'DISABLED'])
  const merchantSuspended = sumCardStatus('merchants', ['SUSPENDED', 'DISABLED'])
  const branchSuspended = sumCardStatus('branches', ['SUSPENDED', 'DISABLED'])

  const criticalSuspendedTenants = tenantSuspended + merchantSuspended + branchSuspended

  const deviceMa = sumCardStatus('devices', ['MA', 'MAINTENANCE'])
  const deviceUnbound = sumCardStatus('assets', ['UNBOUND'])
  const deviceUnhealthy = sumCardStatus('devices', ['UNBOUND', 'MA', 'INACTIVE', 'OFFLINE'])

  if (waitingOrders > 0) {
    alerts.push({
      id: 'orders-waiting',
      level: 'critical',
      title: tx('คำสั่งรอชำระ', 'Orders Awaiting Payment'),
      summary: tx('พบสถานะออเดอร์รอการจ่ายเงิน', 'Found orders waiting for payment'),
      count: waitingOrders,
      link: '/admin/tenant?status=order_waiting_payment',
      linkLabel: tx('ตรวจออเดอร์รอชำระ', 'Review waiting orders')
    })
  }

  if (failedOrders > 0) {
    alerts.push({
      id: 'orders-failed',
      level: 'high',
      title: tx('ออเดอร์ชำรุด', 'Failed Orders'),
      summary: tx('พบสถานะออเดอร์ผิดปกติ', 'Found abnormal/failed order statuses'),
      count: failedOrders,
      link: '/admin/tenant?status=order_failed',
      linkLabel: tx('ตรวจออเดอร์ไม่สมบูรณ์', 'Inspect failed orders')
    })
  }

  if (runningOrders > 0) {
    alerts.push({
      id: 'orders-running',
      level: 'medium',
      title: tx('ออเดอร์กำลังทำงาน', 'Running Orders'),
      summary: tx('มีคำสั่งที่กำลังใช้งานเครื่องในช่วงเวลาที่เลือก', 'Orders are currently running in the selected period'),
      count: runningOrders,
      link: '/admin/tenant?status=order_running',
      linkLabel: tx('ติดตามออเดอร์ดำเนินการ', 'Track running orders')
    })
  }

  if (failedPayments > 0) {
    alerts.push({
      id: 'payment-failed',
      level: 'high',
      title: tx('การชำระเงินล้มเหลว', 'Failed Payments'),
      summary: tx('พบธุรกรรมที่ต้องรีวิว', 'Found transactions that need review'),
      count: failedPayments,
      link: '/admin/settings',
      linkLabel: tx('ดูการตั้งค่า Payment', 'Open payment settings')
    })
  }

  if (disputedPayments > 0) {
    alerts.push({
      id: 'payment-disputed',
      level: 'medium',
      title: tx('รายการ Payment ติดค้าง', 'Pending Payments'),
      summary: tx('พบรายการค้าง/ยืนยันช้า', 'Found pending/slow-to-verify payments'),
      count: disputedPayments,
      link: '/admin/settings',
      linkLabel: tx('ดูแนวทางแก้ปัญหา', 'View troubleshooting guide')
    })
  }

  if (criticalSuspendedTenants > 0) {
    alerts.push({
      id: 'account-status',
      level: 'high',
      title: tx('Tenant/Merchant/Branch ไม่พร้อมใช้งาน', 'Unavailable Tenant/Merchant/Branch'),
      summary: tx('มีสถานะ Suspended/Disabled ที่ต้องตรวจสอบ', 'Suspended/disabled statuses require investigation'),
      count: criticalSuspendedTenants,
      link: '/admin/tenant?status=resource_unavailable',
      linkLabel: tx('ตรวจสอบโครงสร้างองค์กร', 'Check organization structure')
    })
  }

  if (deviceUnhealthy > 0) {
    alerts.push({
      id: 'device-health',
      level: 'medium',
      title: tx('อุปกรณ์มีความเสี่ยง', 'Device Risk Detected'),
      summary: `MA/Unbound/Offline: ${deviceMa + deviceUnbound}`,
      count: deviceUnhealthy,
      link: '/admin/ops?section=device',
      linkLabel: tx('ตรวจสอบ Device', 'Inspect devices')
    })
  }

  const orderTotal = findCard('orders')?.total || 0
  if (orderTotal > 0) {
    const badOrderPercent = ((failedOrders + waitingOrders) / orderTotal) * 100
    if (badOrderPercent >= 20) {
      alerts.push({
        id: 'order-ratio',
        level: 'medium',
        title: tx('อัตราออเดอร์ผิดปกติ', 'Abnormal Order Ratio'),
        summary: tx('ออเดอร์รอ/ล้มเหลวเกิน 20%', 'Waiting/failed orders exceed 20%'),
        count: Math.round(badOrderPercent),
        link: '/admin/tenant',
        linkLabel: tx('ดูแนวโน้มใน Tenant', 'View tenant trend')
      })
    }
  }

  const paymentTotal = findCard('payments')?.total || 0
  if (paymentTotal > 0) {
    const badPaymentPercent = ((failedPayments) / paymentTotal) * 100
    if (badPaymentPercent >= 15) {
      alerts.push({
        id: 'payment-ratio',
        level: 'high',
        title: tx('อัตราการชำระผิดปกติ', 'Abnormal Payment Ratio'),
        summary: tx('อัตรา Payment ล้มเหลวเกิน 15%', 'Failed payment ratio exceeds 15%'),
        count: Math.round(badPaymentPercent),
        link: '/admin/settings',
        linkLabel: tx('เช็ค Payment Logs', 'Check payment logs')
      })
    }
  }

  const levelOrder: Record<AlertLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  }

  return alerts.sort((a, b) => {
    const byLevel = levelOrder[a.level] - levelOrder[b.level]
    if (byLevel !== 0) return byLevel
    return b.count - a.count
  })
})

function alertClass(level: AlertLevel) {
  if (level === 'critical') {
    return {
      root: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
      badge: 'text-rose-600 dark:text-rose-200',
      priority: 'bg-rose-600/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200 ring-1 ring-rose-600/40',
      icon: 'i-lucide-triangle-alert'
    }
  }
  if (level === 'high') {
    return {
      root: 'border-red-300/75 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100',
      badge: 'text-red-600 dark:text-red-200',
      priority: 'bg-red-600/15 text-red-700 dark:bg-red-500/20 dark:text-red-200 ring-1 ring-red-600/45',
      icon: 'i-lucide-alert-triangle'
    }
  }
  if (level === 'medium') {
    return {
      root: 'border-blue-300/70 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
      badge: 'text-blue-700 dark:text-blue-200',
      priority: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200 ring-1 ring-blue-500/35',
      icon: 'i-lucide-circle-alert'
    }
  }
  return {
    root: 'border-slate-300/70 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
    badge: 'text-slate-700 dark:text-slate-200',
    priority: 'bg-slate-500/15 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200 ring-1 ring-slate-500/35',
    icon: 'i-lucide-bell'
  }
}

function alertLevelLabel(level: AlertLevel) {
  const map: Record<AlertLevel, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW'
  }
  return map[level]
}

function fmtDay(value: string, withWeekday = false) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    ...(withWeekday ? { weekday: 'short' as const } : {})
  }).format(new Date(value))
}

const activeRangeLabel = computed(() => {
  const periodMode = data.value?.filters?.period
  const start = data.value?.filters?.start
  const end = data.value?.filters?.end
  if (!start || !end) return ''

  if (periodMode === 'month') {
    const s = new Date(start)
    const e = new Date(end)
    const monthText = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(e)
    return `${s.getDate()} - ${e.getDate()} ${monthText}`
  }

  if (periodMode === 'week') {
    return `${fmtDay(start, true)} - ${fmtDay(end, true)}`
  }

  return `${fmtDay(start)} - ${fmtDay(end)}`
})

const cardsRangeLabel = computed(() => {
  const periodMode = cardsData.value?.filters?.period
  const start = cardsData.value?.filters?.start
  const end = cardsData.value?.filters?.end
  if (!start || !end) return ''

  if (periodMode === 'month') {
    const s = new Date(start)
    const e = new Date(end)
    const monthText = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(e)
    return `${s.getDate()} - ${e.getDate()} ${monthText}`
  }

  if (periodMode === 'week') {
    return `${fmtDay(start, true)} - ${fmtDay(end, true)}`
  }

  return `${fmtDay(start)} - ${fmtDay(end)}`
})
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

const row1Cards = computed(() =>
  ['tenants', 'merchants', 'branches']
    .map(key => cardByKey.value.get(key))
    .filter((item): item is DashboardCard => Boolean(item))
)
const row2Cards = computed(() =>
  ['assets', 'asset_types', 'devices']
    .map(key => cardByKey.value.get(key))
    .filter((item): item is DashboardCard => Boolean(item))
)
const row3Cards = computed(() =>
  ['orders', 'payments']
    .map(key => cardByKey.value.get(key))
    .filter((item): item is DashboardCard => Boolean(item))
)

function cardChartType(card: DashboardCard): CardChartType {
  if (['tenants', 'merchants', 'branches'].includes(card.key)) return 'pie'
  if (card.key === 'assets') return 'pie'
  if (card.key === 'orders') return 'bar'
  if (card.key === 'payments') return 'donut'
  if (card.key === 'devices') return 'bar'
  if (card.key === 'asset_types') return 'bar'
  return 'donut'
}

function cardChartHeight(card: DashboardCard) {
  if (card.key === 'orders') return 210
  if (card.key === 'devices') return 200
  if (card.key === 'asset_types') return 220
  return 190
}

function statusColor(label: string, fallbackIndex = 0) {
  const normalized = String(label || '').toUpperCase()
  if (normalized === 'ACTIVE' || normalized.endsWith('_ACTIVE')) return '#22c55e' // green
  if (
    normalized === 'INACTIVE' ||
    normalized === 'SUSPENDED' ||
    normalized.endsWith('_INACTIVE')
  ) return '#ef4444' // red
  if (
    normalized === 'MA' ||
    normalized === 'MAINTENANCE' ||
    normalized.includes('MAINTENANCE') ||
    normalized === 'UNBOUND'
  ) return '#f59e0b' // amber
  if (normalized === 'DISABLED' || normalized.endsWith('_DISABLED')) return '#94a3b8' // grey
  const freePalette = ['#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#a855f7', '#14b8a6', '#6366f1', '#f97316']
  return freePalette[fallbackIndex % freePalette.length] || '#3b82f6'
}

function statusOrder(label: string) {
  const normalized = String(label || '').toUpperCase()
  if (normalized === 'ACTIVE' || normalized.endsWith('_ACTIVE')) return 0
  if (
    normalized === 'SUSPENDED' ||
    normalized === 'INACTIVE' ||
    normalized.endsWith('_INACTIVE')
  ) return 1
  if (normalized === 'DISABLED' || normalized.endsWith('_DISABLED')) return 2
  return 3
}

function sortedStatuses(card: DashboardCard) {
  return [...card.statuses]
    .sort((a, b) => {
      const rankDiff = statusOrder(a.label) - statusOrder(b.label)
      if (rankDiff !== 0) return rankDiff
      return a.label.localeCompare(b.label)
    })
}

function cardSeriesData(card: DashboardCard) {
  return sortedStatuses(card).map(item => item.count)
}

function cardLabels(card: DashboardCard) {
  return sortedStatuses(card).map(item => item.label)
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

function cardRenderKey(card: DashboardCard, chartType: CardChartType) {
  const signature = sortedStatuses(card)
    .map(item => `${item.label}:${item.count}`)
    .join('|')
  return `${card.key}-${chartType}-${signature}`
}

function tenantAxisLabel(item: { tenantName: string; tenantCode: string }) {
  const name = String(item.tenantName || '').trim()
  const code = String(item.tenantCode || '').trim()
  return name || code || '-'
}

function cardChartOptions(card: DashboardCard, chartType: CardChartType): ApexOptions {
  const isDark = colorMode.value === 'dark'
  const labels = cardLabels(card)
  const colors = labels.map((label, idx) => statusColor(label, idx))
  const isPieLike = chartType === 'donut' || chartType === 'pie'

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
    dataLabels: isPieLike
      ? {
          enabled: true,
          formatter: (_val: number, opts?: { seriesIndex: number; w: { globals: { series: number[] } } }) => {
            if (!opts) return ''
            return String(opts.w.globals.series[opts.seriesIndex] ?? 0)
          }
        }
      : undefined,
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
      categories: salesRows.value.map(item => tenantAxisLabel(item)),
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
        formatter: (val) => isThai.value
          ? `${Number(val).toLocaleString(numberLocale.value)} บาท`
          : `${Number(val).toLocaleString(numberLocale.value)} THB`
      }
    },
    colors: salesRows.value.map((_, index) => chartPalette[index % chartPalette.length])
  }
})

function formatMoney(value: number) {
  return value.toLocaleString(numberLocale.value)
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
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ tx('ยอดขายรวม (Multi-Tenant)', 'Total Sales (Multi-Tenant)') }}</h3>
          <div class="flex flex-wrap items-center gap-2">
            <select v-model="chartMode" class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="top5">Top-5</option>
              <option value="top10">Top-10</option>
              <option value="custom">Custom</option>
            </select>
            <select v-model="period" class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="24h">24h</option>
              <option value="week">week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Date Range</option>
            </select>
            <input
              v-if="period === 'month' || period === 'week'"
              v-model="selectedMonth"
              type="month"
              class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
            <select
              v-if="period === 'week'"
              v-model.number="selectedWeekOfMonth"
              class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option v-for="weekNo in weekOptions" :key="weekNo" :value="weekNo">Week {{ weekNo }}</option>
            </select>
            <template v-if="period === 'custom'">
              <input
                v-model="startDate"
                type="date"
                class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
              <input
                v-model="endDate"
                type="date"
                class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
            </template>
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
                {{ item.name }}
              </option>
            </select>
          </label>
          <p v-if="chartMode === 'custom'" class="text-xs text-slate-500 dark:text-slate-400">{{ tx('Tip: กด `Ctrl/Cmd` เพื่อเลือกหลาย tenant', 'Tip: Press `Ctrl/Cmd` to select multiple tenants') }}</p>
        </div>

        <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Sales</p>
              <p v-if="activeRangeLabel" class="text-xs text-slate-500 dark:text-slate-400">Data range: {{ activeRangeLabel }}</p>
            </div>
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

    <div class="space-y-1">
      <div class="flex items-center justify-between gap-3">
        <p class="text-base font-semibold text-slate-700 dark:text-slate-200">Alert Summary</p>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ cardsAlertSummary.length }} item(s)</p>
      </div>
      <div v-if="cardsAlertSummary.length" class="grid gap-1.5 grid-cols-1">
        <div
          v-for="alert in cardsAlertSummary"
          :key="alert.id"
          :class="`rounded-lg border px-3 py-2 ${alertClass(alert.level).root}`"
        >
          <div class="grid gap-2 lg:grid-cols-[1.2fr_2fr_auto] lg:items-center lg:grid-rows-1">
            <div class="min-w-0">
              <div class="mb-0.5 flex items-center gap-2">
                <div class="text-sm font-semibold" :class="alertClass(alert.level).badge">
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon :name="alertClass(alert.level).icon" class="size-4" />
                    {{ alert.title }}
                  </span>
                </div>
                <span
                  :class="`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${alertClass(alert.level).priority}`"
                >
                  {{ alertLevelLabel(alert.level) }}
                </span>
              </div>
            </div>

            <p class="min-w-0 text-sm text-slate-700 dark:text-slate-200" :title="alert.summary">
              {{ alert.summary }}
            </p>

            <div class="flex min-w-0 items-center justify-end gap-2">
              <p class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ alert.count }}</p>
              <NuxtLink :to="alert.link" class="inline-block whitespace-nowrap text-sm font-semibold text-sky-700 underline-offset-2 hover:underline dark:text-sky-300">
                {{ alert.linkLabel }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="rounded-lg border border-emerald-200/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
        {{ tx('ไม่มี alert ในช่วงเวลาที่เลือก', 'No alerts in selected period') }}
      </div>
    </div>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ tx('จำนวนรวมและสถานะตามตารางข้อมูล', 'Totals and statuses by data table') }}</h3>
            <p v-if="cardsRangeLabel" class="text-xs text-slate-500 dark:text-slate-400">Data range: {{ cardsRangeLabel }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select v-model="cardsTenantMode" class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="all">All Tenants</option>
              <option value="custom">Selected Tenants</option>
            </select>
            <select v-model="cardsPeriod" class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="24h">24h</option>
              <option value="week">week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Date Range</option>
            </select>
            <input
              v-if="cardsPeriod === 'month' || cardsPeriod === 'week'"
              v-model="cardsSelectedMonth"
              type="month"
              class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
            <select
              v-if="cardsPeriod === 'week'"
              v-model.number="cardsSelectedWeekOfMonth"
              class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option v-for="weekNo in cardsWeekOptions" :key="weekNo" :value="weekNo">Week {{ weekNo }}</option>
            </select>
            <template v-if="cardsPeriod === 'custom'">
              <input
                v-model="cardsStartDate"
                type="date"
                class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
              <input
                v-model="cardsEndDate"
                type="date"
                class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
            </template>
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="cardsPending"
              @click="() => refreshCards()"
            >
              Refresh
            </UButton>
          </div>
        </div>
      </template>

      <div v-if="cardsTenantMode === 'custom'" class="mb-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <label class="block text-xs text-slate-500 dark:text-slate-400">
          Tenants in Cards
          <select
            v-model="cardsSelectedTenantIds"
            multiple
            size="8"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option v-for="item in tenantOptions" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="cardsError" class="mb-4 rounded-lg border border-rose-300/60 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
        {{ cardsError.message }}
      </div>

      <div v-if="cardsPending && !cards.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading status cards...
      </div>
      <div v-else class="space-y-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="card in row1Cards"
            :key="card.key"
            class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ card.title }}</p>
              <p class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ card.total }}</p>
            </div>
            <div v-if="card.statuses.length" class="mt-3">
              <ClientOnly>
                <ApexChart
                  :key="cardRenderKey(card, cardChartType(card))"
                  :type="cardChartType(card)"
                  :height="cardChartHeight(card)"
                  :options="cardChartOptions(card, cardChartType(card))"
                  :series="cardSeries(card, cardChartType(card))"
                />
              </ClientOnly>
            </div>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="card in row2Cards"
            :key="card.key"
            class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ card.title }}</p>
              <p class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ card.total }}</p>
            </div>
            <div v-if="card.statuses.length" class="mt-3">
              <ClientOnly>
                <ApexChart
                  :key="cardRenderKey(card, cardChartType(card))"
                  :type="cardChartType(card)"
                  :height="cardChartHeight(card)"
                  :options="cardChartOptions(card, cardChartType(card))"
                  :series="cardSeries(card, cardChartType(card))"
                />
              </ClientOnly>
            </div>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
          <div
            v-for="card in row3Cards"
            :key="card.key"
            class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ card.title }}</p>
              <p class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ card.total }}</p>
            </div>
            <div v-if="card.statuses.length" class="mt-3">
              <ClientOnly>
                <ApexChart
                  :key="cardRenderKey(card, cardChartType(card))"
                  :type="cardChartType(card)"
                  :height="cardChartHeight(card)"
                  :options="cardChartOptions(card, cardChartType(card))"
                  :series="cardSeries(card, cardChartType(card))"
                />
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
