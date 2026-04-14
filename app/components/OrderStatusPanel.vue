<script setup lang="ts">
import type { OrderDetails } from '~~/shared/types'

defineProps<{
  order: OrderDetails
}>()

const itemStatusMap: Record<string, string> = {
  PENDING: 'Reserved',
  QUEUED: 'Reserved',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed'
}
</script>

<template>
  <div class="section-card p-4">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.25em] text-teal-700/70">Order</p>
        <h3 class="text-lg font-semibold text-slate-900">{{ order.orderNumber }}</h3>
      </div>
    </div>

    <div class="mt-4 space-y-3">
      <div
        v-for="item in order.items"
        :key="item.id"
        class="rounded-2xl bg-slate-50 px-4 py-3"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-medium text-slate-900">{{ item.machine.name }}</p>
            <p class="text-sm text-slate-600">{{ item.priceLabel }} • {{ item.durationMinutes }} นาที</p>
          </div>
          <UBadge
            :color="item.status === 'COMPLETED' ? 'success' : item.status === 'FAILED' ? 'error' : 'warning'"
            variant="soft"
            class="px-3 py-1 text-base font-semibold"
          >
            {{ itemStatusMap[item.status] || item.status }}
          </UBadge>
        </div>
      </div>
    </div>
  </div>
</template>
