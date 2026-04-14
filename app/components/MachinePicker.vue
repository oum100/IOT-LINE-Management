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

const washerDisplayLabels = ['Cold', 'Warm', 'Hot']
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
        v-for="(price, index) in machine.prices"
        :key="price.id"
        class="rounded-2xl border px-4 py-3 text-center transition hover:-translate-y-0.5"
        :class="price.id === selectedPriceId
          ? 'border-teal-500 bg-teal-100/80 shadow-sm'
          : 'border-teal-100 bg-teal-50/60 hover:border-teal-300 hover:bg-white'"
        @click="emit('select', price.id)"
      >
        <div class="space-y-1">
          <p class="font-medium text-slate-900">{{ price.durationMinutes }} นาที</p>
          <p v-if="machine.kind === 'WASHER'" class="text-sm text-slate-600">
            {{ washerDisplayLabels[index] || price.label }}
          </p>
          <p class="text-xl font-semibold text-teal-700">{{ price.amount }}</p>
        </div>
      </button>
    </div>
  </div>
</template>
