<script setup lang="ts">
const props = defineProps<{
  open: boolean
  loading?: boolean
  error?: string
  assetName?: string
  assetCode?: string
  productName?: string
  productCode?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <UModal :open="open" :ui="{ content: 'sm:max-w-lg' }" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Unbind Product</h3>
        </template>
        <div class="space-y-3">
          <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
          <p class="text-sm text-slate-700 dark:text-slate-200">Please confirm product unbind for this asset.</p>
          <div class="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p class="text-sm text-slate-700 dark:text-slate-200">
              <span class="font-semibold text-slate-900 dark:text-slate-100">Asset:</span>
              <span class="ml-2 font-semibold text-slate-900 dark:text-slate-100">{{ assetName || '-' }}</span>
              <span class="ml-1 text-slate-500 dark:text-slate-400">({{ assetCode || '-' }})</span>
            </p>
            <p class="text-sm text-slate-700 dark:text-slate-200">
              <span class="font-semibold text-slate-900 dark:text-slate-100">Product:</span>
              <span class="ml-2 font-semibold text-slate-900 dark:text-slate-100">{{ productName || '-' }}</span>
              <span class="ml-1 text-slate-500 dark:text-slate-400">({{ productCode || '-' }})</span>
            </p>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="emit('update:open', false)">Cancel</UButton>
            <UButton color="error" :loading="loading" @click="emit('confirm')">Unbind</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
