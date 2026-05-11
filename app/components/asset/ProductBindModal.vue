<script setup lang="ts">
import { computed } from 'vue'

type ProductOption = {
  id: string
  code: string
  name: string
  kind: string
  amount: number
  quantity: number | null
  serviceUnit: string | null
}

type ScopeOption = {
  id: string
  name: string
}

type AssetOption = {
  id: string
  code: string
  name: string
}

const props = defineProps<{
  open: boolean
  loading?: boolean
  error?: string
  options: ProductOption[]
  modelValue: string
  tenants?: ScopeOption[]
  merchants?: ScopeOption[]
  branches?: ScopeOption[]
  assets?: AssetOption[]
  tenantId?: string
  merchantAccountId?: string
  branchId?: string
  assetIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'update:modelValue', value: string): void
  (e: 'update:tenantId', value: string): void
  (e: 'update:merchantAccountId', value: string): void
  (e: 'update:branchId', value: string): void
  (e: 'update:assetIds', value: string[]): void
  (e: 'submit'): void
}>()

const selectUi = {
  base: 'h-10 bg-white text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-500',
  placeholder: 'text-slate-600 dark:text-slate-300',
  value: 'text-slate-900 dark:text-slate-100',
  trailingIcon: 'text-slate-600 dark:text-slate-300',
  content: 'bg-white ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600',
  viewport: 'divide-y divide-slate-200 dark:divide-slate-700',
  item: 'text-slate-900 data-highlighted:not-data-disabled:text-slate-900 data-highlighted:not-data-disabled:before:bg-slate-200 dark:text-slate-100 dark:data-highlighted:not-data-disabled:text-slate-100 dark:data-highlighted:not-data-disabled:before:bg-slate-700/70',
  itemLabel: 'text-slate-900 dark:text-slate-100',
  itemDescription: 'text-slate-600 dark:text-slate-300'
}
const tenantOptions = computed(() => (props.tenants || []).map(item => ({ label: item.name, value: item.id })))
const merchantOptions = computed(() => (props.merchants || []).map(item => ({ label: item.name, value: item.id })))
const branchOptions = computed(() => (props.branches || []).map(item => ({ label: item.name, value: item.id })))
const productOptions = computed(() => (props.options || []).map(item => ({ label: `${item.name} (${item.code})`, value: item.id })))

function toggleAsset(id: string) {
  const set = new Set(props.assetIds || [])
  if (set.has(id)) set.delete(id)
  else set.add(id)
  emit('update:assetIds', Array.from(set))
}
</script>

<template>
  <UModal :open="open" :ui="{ content: 'sm:max-w-4xl' }" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Bind Product</h3>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emit('update:open', false)" />
          </div>
        </template>
        <div class="space-y-4">
          <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
          <div class="grid gap-3 md:grid-cols-3">
            <UFormField label="Tenant">
              <USelect
                class="w-full"
                :model-value="tenantId || ''"
                :items="tenantOptions"
                value-key="value"
                placeholder="Select tenant"
                :ui="selectUi"
                @update:model-value="emit('update:tenantId', String($event || ''))"
              />
            </UFormField>
            <UFormField label="Merchant">
              <USelect
                class="w-full"
                :model-value="merchantAccountId || ''"
                :items="merchantOptions"
                value-key="value"
                placeholder="Select merchant"
                :ui="selectUi"
                @update:model-value="emit('update:merchantAccountId', String($event || ''))"
              />
            </UFormField>
            <UFormField label="Branch">
              <USelect
                class="w-full"
                :model-value="branchId || ''"
                :items="branchOptions"
                value-key="value"
                placeholder="Select branch"
                :ui="selectUi"
                @update:model-value="emit('update:branchId', String($event || ''))"
              />
            </UFormField>
          </div>

          <UFormField label="Product">
            <USelect
              class="w-full"
              :model-value="modelValue"
              :items="productOptions"
              value-key="value"
              placeholder="Select product"
              :ui="selectUi"
              @update:model-value="emit('update:modelValue', String($event || ''))"
            />
          </UFormField>

          <UFormField label="Assets (multi-select)">
            <div class="max-h-56 overflow-auto rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
              <div v-if="!(assets || []).length" class="px-2 py-3 text-sm text-slate-500 dark:text-slate-400">No assets in selected scope</div>
              <label
                v-for="asset in (assets || [])"
                :key="asset.id"
                class="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{{ asset.name }}</p>
                  <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ asset.code }}</p>
                </div>
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                  :checked="(assetIds || []).includes(asset.id)"
                  @change="toggleAsset(asset.id)"
                >
              </label>
            </div>
          </UFormField>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="emit('update:open', false)">Cancel</UButton>
            <UButton color="primary" class="text-white dark:text-white" :loading="loading" :disabled="!modelValue || !(assetIds || []).length || !tenantId || !merchantAccountId || !branchId" @click="emit('submit')">Bind</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
