<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore } from '~~/stores/cart'

const props = withDefaults(defineProps<{
  pending?: boolean
  canCheckout?: boolean
}>(), {
  pending: false,
  canCheckout: false
})

const emit = defineEmits<{
  checkout: []
}>()

const cart = useCartStore()
const total = computed(() => cart.totalAmount)

function unitLabel(unit?: string) {
  if (unit === 'MINUTE') return 'min'
  if (unit === 'SECOND') return 'sec'
  if (unit === 'LITER') return 'L'
  if (unit === 'GRAM') return 'g'
  if (unit === 'PIECE') return 'piece'
  if (unit === 'BOX') return 'box'
  if (unit === 'SLOT') return 'slot'
  return ''
}

function serviceText(item: {
  serviceMode?: string
  durationMinutes: number
  serviceUnit?: string
  quantity?: number | null
}) {
  if (item.serviceMode === 'TIME' || !item.serviceMode) {
    return `${item.durationMinutes} ${unitLabel(item.serviceUnit || 'MINUTE')}`
  }
  const qty = item.quantity == null ? 1 : Number(item.quantity)
  return `${qty} ${unitLabel(item.serviceUnit)}`
}
</script>

<template>
  <div class="section-card p-4">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.25em] text-orange-500">Step 3</p>
        <h3 class="text-lg font-semibold text-slate-900">สรุปรายการ และยอดรวม</h3>
      </div>
      <UBadge color="warning" variant="soft">{{ cart.items.length }} รายการ</UBadge>
    </div>

    <div v-if="cart.items.length" class="mt-4 space-y-3">
      <div
        v-for="item in cart.items"
        :key="item.cartId"
        class="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3"
      >
        <div>
          <p class="font-medium text-slate-900">{{ item.machineName }}</p>
          <p class="text-sm text-slate-600">{{ item.priceLabel }} • {{ serviceText(item) }}</p>
        </div>
        <div class="flex items-center gap-3">
          <p class="font-semibold text-slate-900">{{ item.amount }} บาท</p>
          <UButton color="neutral" variant="ghost" icon="i-lucide-trash-2" @click="cart.removeSelection(item.cartId)" />
        </div>
      </div>
    </div>

    <div v-else class="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
      เลือกเครื่องและราคาบริการก่อน แล้วสรุปรายการจะมาแสดงตรงนี้
    </div>

    <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
      <span class="text-sm text-slate-500">ยอดรวม</span>
      <span class="text-2xl font-semibold text-teal-700">{{ total }} บาท</span>
    </div>

    <button
      type="button"
      class="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="!props.canCheckout || props.pending"
      @click="emit('checkout')"
    >
      {{ props.pending ? 'Creating Order...' : 'Checkout. ชำระบริการ' }}
    </button>
  </div>
</template>
