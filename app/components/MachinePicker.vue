<script setup lang="ts">
import type { MachineWithPrices } from '~~/shared/types'

const props = defineProps<{
  machine: MachineWithPrices
  selectedPriceId?: string | null
  slotLabel?: string
}>()

const emit = defineEmits<{
  select: [priceId: string]
}>()

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

function serviceText(price: MachineWithPrices['prices'][number]) {
  if (price.serviceMode === 'TIME') {
    return `${price.durationMinutes} ${unitLabel(price.serviceUnit || 'MINUTE')}`
  }
  const qty = price.quantity == null ? 1 : Number(price.quantity)
  return `${qty} ${unitLabel(price.serviceUnit)}`
}
</script>

<template>
  <div class="section-card p-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h3 class="text-3xl font-semibold text-slate-900">{{ machine.name }}</h3>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-3 gap-3">
      <button
        v-for="price in machine.prices"
        :key="price.id"
        class="rounded-2xl border px-4 py-3 text-center transition hover:-translate-y-0.5"
        :class="price.id === selectedPriceId
          ? 'border-teal-700 bg-teal-100 ring-4 ring-teal-300 shadow-lg shadow-teal-200/70'
          : 'border-teal-100 bg-teal-50/60 hover:border-teal-300 hover:bg-white'"
        @click="emit('select', price.id)"
      >
        <div class="space-y-1">
          <p class="font-medium text-slate-900">{{ price.label }}</p>
          <p class="text-sm text-slate-600">{{ serviceText(price) }}</p>
          <p class="text-xl font-semibold text-teal-700">{{ price.amount }}</p>
        </div>
      </button>
    </div>
  </div>
</template>
