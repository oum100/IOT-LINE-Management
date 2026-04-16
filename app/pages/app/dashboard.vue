<script setup lang="ts">
definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})
const { t } = useAppLocale()

const { data } = await useFetch<{
  scope: string
  machine: {
    total: number
    available: number
    reserved: number
    running: number
    maintenance: number
  }
  order: {
    total: number
    pendingPayment: number
    inProgress: number
    completed: number
  }
}>('/api/app/dashboard')

const machineSeries = computed(() => {
  const machine = data.value?.machine
  if (!machine) return []
  return [
    { label: 'Available', value: machine.available, color: 'bg-emerald-500' },
    { label: 'Reserved', value: machine.reserved, color: 'bg-amber-500' },
    { label: 'Running', value: machine.running, color: 'bg-rose-500' },
    { label: 'Maintenance', value: machine.maintenance, color: 'bg-slate-500' }
  ]
})

const maxSeries = computed(() => Math.max(1, ...machineSeries.value.map(item => item.value)))
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">{{ t('แดชบอร์ด', 'Dashboard') }}</p>
      <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ t('ภาพรวมการปฏิบัติการร้าน', 'Tenant Operations Overview') }}</h2>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ t('ภาพรวมการใช้งานเครื่องและคำสั่งซื้อของร้าน', 'Machine usage and order overview') }}</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">Machines</p>
        <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{{ data?.machine.total || 0 }}</p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">Orders</p>
        <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{{ data?.order.total || 0 }}</p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">Pending Payment</p>
        <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{{ data?.order.pendingPayment || 0 }}</p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">Completed</p>
        <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{{ data?.order.completed || 0 }}</p>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('สัดส่วนสถานะเครื่อง', 'Machine Status Distribution') }}</p>
      <div class="mt-4 space-y-3">
        <div v-for="item in machineSeries" :key="item.label" class="grid grid-cols-[140px_1fr_56px] items-center gap-3">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ item.label }}</p>
          <div class="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              class="h-3 rounded-full transition-all"
              :class="item.color"
              :style="{ width: `${(item.value / maxSeries) * 100}%` }"
            />
          </div>
          <p class="text-right text-sm font-semibold text-slate-900 dark:text-white">{{ item.value }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
