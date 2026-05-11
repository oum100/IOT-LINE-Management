<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from '#app'
import type { OrderStatusView } from '~~/shared/types'

definePageMeta({
  layout: 'liff'
})

const route = useRoute()
const orderId = computed(() => route.params.id as string)
const { data: order, refresh } = await useFetch<OrderStatusView>(() => `/api/orders/${orderId.value}/status`)
let refreshTimer: ReturnType<typeof setInterval> | null = null
let uiTickTimer: ReturnType<typeof setInterval> | null = null
const nowTs = ref(Date.now())

type BadgeTone = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const itemStatusMap: Record<string, { label: string, tone: BadgeTone }> = {
  PENDING: { label: 'Reserved', tone: 'warning' },
  QUEUED: { label: 'Reserved', tone: 'warning' },
  RUNNING: { label: 'Running', tone: 'primary' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'error' }
}

const paymentStatus = computed(() => {
  const status = order.value?.paymentStatus || ''
  if (status === 'VERIFIED') {
    return 'ชำระสำเร็จ'
  }
  if (status === 'PENDING') {
    return 'รอชำระเงิน'
  }
  if (status === 'SLIP_UPLOADED') {
    return 'รอตรวจสลิป'
  }
  if (status === 'REJECTED') {
    return 'ชำระไม่สำเร็จ'
  }
  return status || '-'
})

function remainingText(item: { status: string, durationMinutes: number, startedAt?: string | null, remainingMinutes?: number | null }) {
  if (item.status !== 'RUNNING') {
    return ''
  }

  const startedAtMs = item.startedAt ? new Date(item.startedAt).getTime() : NaN
  const hasStartedAt = Number.isFinite(startedAtMs)
  const elapsedMinutes = hasStartedAt ? Math.floor((nowTs.value - startedAtMs) / 60000) : 0
  const fallbackBase = Number(item.remainingMinutes ?? item.durationMinutes)
  const baseMinutes = hasStartedAt ? item.durationMinutes : fallbackBase
  const remain = Math.max(0, baseMinutes - elapsedMinutes)
  const remainText = String(remain).padStart(2, '0')
  return remain > 0 ? `เหลือ ${remainText} นาที` : 'เหลือ 00 นาที'
}

onMounted(() => {
  refreshTimer = setInterval(() => {
    refresh()
  }, 5000)

  uiTickTimer = setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }

  if (uiTickTimer) {
    clearInterval(uiTickTimer)
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-none px-4 py-4 text-slate-100 sm:px-6 sm:py-6 lg:px-8">
    <div v-if="order" class="space-y-4">
      <div class="section-card p-4">
        <p class="text-xs uppercase tracking-[0.22em] text-teal-300">Live Machine Status</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-100">{{ order.orderNumber }}</h1>
        <p class="mt-1 text-sm text-slate-300">ลูกค้า {{ order.customerName }}</p>
        <div class="mt-3 flex items-center gap-2">
          <UBadge color="warning" variant="soft" class="px-3 py-1 text-sm font-semibold">
            {{ paymentStatus }}
          </UBadge>
          <button
            type="button"
            class="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700"
            @click="refresh()"
          >
            Refresh
          </button>
        </div>
        <p class="mt-2 text-xs text-slate-300">อัปเดตล่าสุด {{ new Date(order.updatedAt).toLocaleTimeString('th-TH') }}</p>
      </div>

      <div class="section-card p-4">
        <p class="text-xs uppercase tracking-[0.22em] text-teal-300">Machines</p>
        <div class="mt-3 space-y-3">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-lg font-semibold text-slate-100">{{ item.machineName }}</p>
                <p class="text-sm text-slate-300">{{ item.durationMinutes }} นาที • {{ item.amount }} บาท</p>
              </div>
              <div class="text-right">
                <UBadge
                  :color="itemStatusMap[item.status]?.tone || 'neutral'"
                  variant="soft"
                  class="px-3 py-1 text-base font-semibold"
                >
                  {{ itemStatusMap[item.status]?.label || item.status }}
                </UBadge>
                <p
                  v-if="item.status === 'RUNNING'"
                  class="mt-1 text-base font-semibold text-slate-200"
                >
                  {{ remainingText(item) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
