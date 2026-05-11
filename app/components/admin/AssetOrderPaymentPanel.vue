<script setup lang="ts">
import { selectWidth, uiControlClass } from '~/constants/ui-controls'

type SelectItem = { label: string; value: string }
type OrderItem = {
  id: string
  orderNumber: string
  status: string
  customerName?: string | null
  totalAmount: number
  createdAt: string
  payment?: { status?: string | null } | null
}

const props = defineProps<{
  orderSearch: string
  orderStatusFilter: string
  paymentStatusFilter: string
  orderStatusOptions: SelectItem[]
  paymentStatusOptions: SelectItem[]
  orderItems: OrderItem[]
  selectedOrderId: string
  orderListLoading: boolean
  orderPage: number
  orderTotalPages: number
  orderTotal: number
  hasPrevOrderPage: boolean
  hasNextOrderPage: boolean
  selectedOrder?: { orderNumber: string } | null
  orderTimelineLoading: boolean
  timelineItems: any[]
  paymentTimeline: any[]
}>()

const emit = defineEmits<{
  (e: 'update:orderSearch', value: string): void
  (e: 'update:orderStatusFilter', value: string): void
  (e: 'update:paymentStatusFilter', value: string): void
  (e: 'applyFilters'): void
  (e: 'selectOrder', item: OrderItem): void
  (e: 'goToOrderPage', page: number): void
}>()

const searchModel = computed({
  get: () => props.orderSearch,
  set: (value: string) => emit('update:orderSearch', value)
})
const orderStatusModel = computed({
  get: () => props.orderStatusFilter,
  set: (value: string) => emit('update:orderStatusFilter', value)
})
const paymentStatusModel = computed({
  get: () => props.paymentStatusFilter,
  set: (value: string) => emit('update:paymentStatusFilter', value)
})
const selectClass = selectWidth(uiControlClass.select, 'w-[220px]')

function orderStatusBadgeColor(status: string) {
  const s = String(status || '').toUpperCase()
  if (s === 'COMPLETED' || s === 'PAID') return 'success'
  if (s === 'CANCELLED' || s === 'FAILED') return 'error'
  if (s === 'IN_PROGRESS' || s === 'PENDING') return 'primary'
  return 'neutral'
}

function paymentStatusBadgeColor(status: string) {
  const s = String(status || '').toUpperCase()
  if (s === 'VERIFIED' || s === 'PAID') return 'success'
  if (s === 'REJECTED' || s === 'FAILED') return 'error'
  if (s === 'PENDING' || s === 'CREATED') return 'warning'
  return 'neutral'
}
</script>

<template>
  <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
    <template #header>
      <h3 class="text-base font-semibold text-slate-900 dark:text-white">Order Info / Payment Info</h3>
    </template>
    <div class="mt-2 flex flex-wrap items-end gap-2">
      <SearchInput v-model="searchModel" placeholder="Search order no./customer/order id" class="w-[280px]" @input="emit('applyFilters')" />
      <select v-model="orderStatusModel" :class="selectClass" @change="emit('applyFilters')">
        <option v-for="item in orderStatusOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <select v-model="paymentStatusModel" :class="selectClass" @change="emit('applyFilters')">
        <option v-for="item in paymentStatusOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
    </div>

    <div class="mt-2 grid gap-2 lg:grid-cols-[1.7fr_.7fr]">
      <div class="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-2 flex items-center justify-between">
          <h4 class="text-base font-semibold text-slate-900 dark:text-white">Order List</h4>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ orderItems.length }} orders</p>
        </div>
        <div class="max-h-[340px] overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
          <table class="w-full min-w-[860px] text-sm">
            <thead class="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-800/90">
              <tr class="text-left text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
                @click="emit('selectOrder', item)"
              >
                <td class="px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white">{{ item.orderNumber }}</td>
                <td class="px-3 py-2"><UBadge variant="soft" :color="orderStatusBadgeColor(item.status)">{{ item.status }}</UBadge></td>
                <td class="px-3 py-2"><UBadge variant="soft" :color="paymentStatusBadgeColor(item.payment?.status || 'NO_PAYMENT')">{{ item.payment?.status || "NO_PAYMENT" }}</UBadge></td>
                <td class="px-3 py-2"><UBadge variant="soft" color="neutral">{{ item.customerName || "-" }}</UBadge></td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ item.totalAmount }}</td>
                <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400"><DateTimeTwoLine :value="item.createdAt" align="right" /></td>
              </tr>
              <tr v-if="!orderListLoading && !orderItems.length">
                <td colspan="6" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No orders found for this asset.</td>
              </tr>
              <tr v-if="orderListLoading">
                <td colspan="6" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading orders...</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <p class="text-sm text-slate-500 dark:text-slate-400">Page {{ orderPage }} / {{ orderTotalPages }} ({{ orderTotal }} total)</p>
          <div class="flex items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevrons-left" :disabled="!hasPrevOrderPage || orderListLoading" @click="emit('goToOrderPage', 1)" />
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevron-left" :disabled="!hasPrevOrderPage || orderListLoading" @click="emit('goToOrderPage', orderPage - 1)" />
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevron-right" :disabled="!hasNextOrderPage || orderListLoading" @click="emit('goToOrderPage', orderPage + 1)" />
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevrons-right" :disabled="!hasNextOrderPage || orderListLoading" @click="emit('goToOrderPage', orderTotalPages)" />
          </div>
        </div>
      </div>

      <div class="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-2">
          <h4 class="text-base font-semibold text-slate-900 dark:text-white">Payment Timeline</h4>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ selectedOrder ? `Order ${selectedOrder.orderNumber}` : "Select an order from the left list" }}</p>
        </div>
        <div v-if="orderTimelineLoading" class="text-sm text-slate-500 dark:text-slate-400">Loading timeline...</div>
        <div v-else class="max-h-[340px] overflow-auto pr-1">
          <UTimeline :items="timelineItems" />
          <p v-if="selectedOrder && !paymentTimeline.length" class="text-sm text-slate-500 dark:text-slate-400">No payment timeline events.</p>
        </div>
      </div>
    </div>
  </UCard>
</template>
