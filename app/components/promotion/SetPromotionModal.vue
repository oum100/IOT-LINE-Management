<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'
import { uiControlClass, uiControlUi } from '~/constants/ui-controls'

type Option = { id: string; code: string; name: string; merchantAccountId?: string }
type PromoProduct = { id: string; code: string; name: string; amount: number } | null
type PromoAsset = { name: string; code?: string | null } | null

const props = defineProps<{
  open: boolean
  saving?: boolean
  asset?: PromoAsset
  product: PromoProduct
  error?: string
  tenants: Option[]
  merchants: Option[]
  branches: Option[]
  defaultMerchantId?: string
  defaultBranchId?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submit', payload: {
    productId: string
    branchId: string
    amount: number
    effectiveFrom: string
    effectiveTo: string | null
    priority: number
    replaceActive: boolean
  }): void
  (e: 'error', message: string): void
}>()

const selectClass = uiControlClass.select
const inputClass = uiControlClass.inputText
const inputUi = uiControlUi.input
const timeUi = uiControlUi.timeInput

const amount = ref<number | null>(null)
const startDate = ref<CalendarDate | null>(null)
const startTime = ref('00:00')
const endDate = ref<CalendarDate | null>(null)
const endTime = ref('23:59')
const startCalendarOpen = ref(false)
const endCalendarOpen = ref(false)
const priority = ref(100)
const replaceActive = ref(false)
const localError = ref('')
const tenantId = ref('')
const merchantId = ref('')
const branchId = ref('')
const isHydrating = ref(false)

const branchOptions = computed(() => props.branches.filter(b => !merchantId.value || b.merchantAccountId === merchantId.value))

function asJsDate(dateValue: CalendarDate | Date | null) {
  if (!dateValue) return null
  if (dateValue instanceof Date) return new Date(dateValue)
  return dateValue.toDate(getLocalTimeZone())
}

function mergeDateAndTime(dateValue: CalendarDate | Date | null, time: string) {
  const date = asJsDate(dateValue)
  if (!date) return null
  const [hour, minute] = String(time || '').split(':').map(v => Number(v || 0))
  const merged = new Date(date)
  merged.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0)
  return merged
}

function fmtInputDate(v: CalendarDate | Date | null) {
  const d = asJsDate(v)
  return d ? d.toLocaleDateString() : 'Select date'
}

function tenantLabel(item: { code?: string | null; name?: string | null }) {
  const code = String(item.code || '').trim()
  const name = String(item.name || '').trim()
  if (!code) return name
  if (!name || name.toLowerCase() === code.toLowerCase()) return code
  return `${code} ${name}`
}

function close() {
  localError.value = ''
  emit('update:open', false)
}

function hydrate() {
  isHydrating.value = true
  amount.value = Number(props.product?.amount || 0)
  const now = new Date()
  startDate.value = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
  endDate.value = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
  startTime.value = '00:00'
  endTime.value = '23:59'
  priority.value = 100
  replaceActive.value = false
  tenantId.value = props.tenants[0]?.id || ''
  merchantId.value = props.defaultMerchantId || ''
  branchId.value = props.defaultBranchId || ''
  startCalendarOpen.value = false
  endCalendarOpen.value = false
  nextTick(() => { isHydrating.value = false })
}

function submit() {
  localError.value = ''
  const startDateTime = mergeDateAndTime(startDate.value, startTime.value)
  const endDateTime = mergeDateAndTime(endDate.value, endTime.value)
  if (!branchId.value) {
    localError.value = 'Please select Branch before setting promotion'
    return
  }
  if (!props.product?.id || amount.value === null || !startDateTime) {
    localError.value = 'Please provide Product, Amount, and Start date/time'
    return
  }
  emit('submit', {
    productId: props.product.id,
    branchId: branchId.value,
    amount: Number(amount.value),
    effectiveFrom: startDateTime.toISOString(),
    effectiveTo: endDateTime ? endDateTime.toISOString() : null,
    priority: Number(priority.value || 100),
    replaceActive: replaceActive.value
  })
}

watch(() => props.open, (v) => {
  if (v) hydrate()
  else {
    localError.value = ''
    startCalendarOpen.value = false
    endCalendarOpen.value = false
  }
})
watch(merchantId, () => {
  if (isHydrating.value) return
  branchId.value = ''
})
</script>

<template>
  <UModal :open="open" :ui="{ content: 'sm:max-w-3xl' }" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Set Promotion</h3>
              <div class="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <p class="text-slate-600 dark:text-slate-300">
                  Asset:
                  <span class="font-semibold text-slate-900 dark:text-slate-100">{{ asset?.name || '-' }}</span>
                  <span v-if="asset?.code" class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">{{ asset.code }}</span>
                </p>
                <p class="text-slate-600 dark:text-slate-300">
                  Product:
                  <span class="font-semibold text-slate-900 dark:text-slate-100">{{ product?.name || '-' }}</span>
                  <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">{{ product?.code || '-' }}</span>
                </p>
              </div>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="close" />
          </div>
        </template>
        <div class="space-y-3">
          <UAlert v-if="error || localError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error || localError" />
          <div class="grid gap-3 md:grid-cols-3">
            <UFormField label="Tenant">
              <select v-model="tenantId" :class="selectClass" disabled>
                <option v-for="t in tenants" :key="t.id" :value="t.id">{{ tenantLabel(t) }}</option>
              </select>
            </UFormField>
            <UFormField label="Merchant">
              <select v-model="merchantId" :class="selectClass">
                <option value="">Select merchant</option>
                <option v-for="m in merchants" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </UFormField>
            <UFormField label="Branch">
              <select v-model="branchId" :class="selectClass">
                <option value="">Select branch</option>
                <option v-for="b in branchOptions" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Promotion Price (THB)">
              <UInput v-model="amount" type="number" min="0" class="w-full" :ui="inputUi" :class="{ [inputClass]: true }" />
            </UFormField>
            <UFormField label="Priority">
              <UInput v-model="priority" type="number" min="1" max="999" class="w-full" :ui="inputUi" :class="{ [inputClass]: true }" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Start Date">
              <UPopover v-model:open="startCalendarOpen">
                <UButton color="neutral" variant="outline" icon="i-lucide-calendar" trailing class="h-10 w-full justify-between border-slate-300 bg-white text-sm font-medium text-slate-900 ring-1 ring-slate-300 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-500">
                  <span>{{ fmtInputDate(startDate) }}</span>
                </UButton>
                <template #content>
                  <div class="rounded-lg bg-white p-2 text-slate-900 ring-1 ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600">
                    <UCalendar v-model="startDate" @update:model-value="startCalendarOpen = false" />
                  </div>
                </template>
              </UPopover>
            </UFormField>
            <UFormField label="Start Time">
              <UInput v-model="startTime" type="time" class="h-10 w-full" :ui="timeUi" :class="{ [inputClass]: true }" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="End Date">
              <UPopover v-model:open="endCalendarOpen">
                <UButton color="neutral" variant="outline" icon="i-lucide-calendar" trailing class="h-10 w-full justify-between border-slate-300 bg-white text-sm font-medium text-slate-900 ring-1 ring-slate-300 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-500">
                  <span>{{ fmtInputDate(endDate) }}</span>
                </UButton>
                <template #content>
                  <div class="rounded-lg bg-white p-2 text-slate-900 ring-1 ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600">
                    <UCalendar v-model="endDate" @update:model-value="endCalendarOpen = false" />
                  </div>
                </template>
              </UPopover>
            </UFormField>
            <UFormField label="End Time">
              <UInput v-model="endTime" type="time" class="h-10 w-full" :ui="timeUi" :class="{ [inputClass]: true }" />
            </UFormField>
          </div>
          <label class="flex h-10 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input v-model="replaceActive" type="checkbox" class="h-4 w-4">
            Replace overlapping active promotion
          </label>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="close">Cancel</UButton>
            <UButton color="primary" class="text-white dark:text-white" :loading="saving" :disabled="!startDate || amount === null" @click="submit">Save Promotion</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
