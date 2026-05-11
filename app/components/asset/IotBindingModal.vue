<script setup lang="ts">
const props = withDefaults(defineProps<{
  open?: boolean
  embedded?: boolean
  assetId: string
  assetName?: string
  apiBase?: string
  allowUnbind?: boolean
  warningBorder?: boolean | null
}>(), {
  open: false,
  embedded: false,
  apiBase: '/api/admin',
  allowUnbind: true,
  warningBorder: null
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'changed'): void
  (e: 'history'): void
}>()

type AssetDetail = {
  id: string
  activeBinding?: {
    startedAt: string
    reason?: string | null
    iotDevice?: {
      id: string
      macAddress: string
      deviceUid?: string | null
      name?: string | null
      model?: string | null
    } | null
  } | null
}

type DeviceOption = {
  id: string
  macAddress: string
  deviceUid?: string | null
}

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const detail = ref<AssetDetail | null>(null)
const devices = ref<DeviceOption[]>([])
const selectedIotDeviceId = ref('')
const reason = ref('')
const unbindConfirmOpen = ref(false)

const isBound = computed(() => Boolean(detail.value?.activeBinding?.iotDevice?.id))
const actionLabel = computed(() => (isBound.value ? 'Replace Now' : 'Bind Now'))
const modalTitle = computed(() => `IoT Device Binding${props.assetName ? ` · ${props.assetName}` : ''}`)
const currentBindingCardClass = computed(() =>
  isBound.value
    ? 'rounded-lg border !border-slate-200 p-3 dark:!border-slate-700'
    : 'rounded-lg border !border-slate-200 p-3 dark:!border-slate-700'
)
const currentBindingStatusClass = computed(() =>
  isBound.value
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-700 dark:text-slate-300'
)
const embeddedCardRootClass = computed(() =>
  (props.warningBorder ?? !isBound.value)
    ? 'h-full border border-amber-600 bg-white dark:border-amber-400 dark:bg-slate-900'
    : 'h-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
)

const deviceOptions = computed(() =>
  devices.value.map(item => ({
    label: `${item.macAddress}${item.deviceUid ? ` (${item.deviceUid})` : ''}`,
    value: item.id,
  })),
)

const bindSelectUi = {
  base: 'h-10 bg-white text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-500',
  placeholder: 'text-slate-500 dark:text-slate-400',
  value: 'text-slate-900 dark:text-slate-100',
  content: 'bg-white dark:bg-slate-800',
  item: 'text-slate-900 dark:text-slate-100'
}

async function loadData() {
  if (!props.assetId) return
  loading.value = true
  error.value = ''
  try {
    const [assetRes, optionsRes] = await Promise.all([
      $fetch<AssetDetail>(`${props.apiBase}/assets/${props.assetId}`),
      $fetch<{ items: DeviceOption[] }>(`${props.apiBase}/assets/${props.assetId}/available-iot-devices`),
    ])
    detail.value = assetRes || null
    devices.value = optionsRes.items || []
    selectedIotDeviceId.value = ''
    reason.value = ''
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Failed to load IoT binding data'
  } finally {
    loading.value = false
  }
}

async function submitBindReplace() {
  if (!props.assetId || !selectedIotDeviceId.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`${props.apiBase}/assets/${props.assetId}/replace-device`, {
      method: 'POST',
      body: {
        iotDeviceId: selectedIotDeviceId.value,
        reason: reason.value.trim() || (isBound.value ? 'replace-device' : 'bind-device'),
      },
    })
    emit('changed')
    if (!props.embedded) emit('update:open', false)
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Failed to bind/replace IoT device'
  } finally {
    saving.value = false
  }
}

async function submitUnbind() {
  if (!props.assetId || !isBound.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`${props.apiBase}/assets/${props.assetId}/unbind-device`, {
      method: 'POST',
      body: {
        reason: reason.value.trim() || 'unbind-device'
      }
    })
    emit('changed')
    if (!props.embedded) emit('update:open', false)
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Failed to unbind IoT device'
  } finally {
    saving.value = false
  }
}

function requestUnbindConfirm() {
  if (!isBound.value || saving.value || loading.value) return
  unbindConfirmOpen.value = true
}

function openHistory() {
  if (!props.assetId) return
  if (props.embedded) {
    emit('history')
    return
  }
  navigateTo(`/admin/asset-detail/${props.assetId}`)
  if (!props.embedded) emit('update:open', false)
}

watch(
  () => [props.open, props.embedded, props.assetId],
  ([isOpen, embedded, assetId]) => {
    if (!assetId) return
    if (embedded || isOpen) void loadData()
  },
  { immediate: true }
)
</script>

<template>
  <UCard
    v-if="embedded"
    :ui="{ root: embeddedCardRootClass }"
  >
    <template #header>
      <h3 class="text-base font-semibold text-slate-600 dark:text-slate-300">IoT Device Binding</h3>
    </template>

    <div class="space-y-3">
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
      <div :class="currentBindingCardClass">
        <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">mac Address</p>
            <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.iotDevice?.macAddress || 'Not bound' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Device UID</p>
            <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.iotDevice?.deviceUid || '-' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Status</p>
            <p class="mt-0.5 text-sm font-semibold" :class="currentBindingStatusClass">{{ isBound ? 'BOUND' : 'UNASSIGNED' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Name</p>
            <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.iotDevice?.name || '-' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Model</p>
            <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.iotDevice?.model || '-' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Binding At</p>
            <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.startedAt ? new Date(detail.activeBinding.startedAt).toLocaleString() : '-' }}</p>
          </div>
          <div class="md:col-span-3">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Reason</p>
            <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.reason || '-' }}</p>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Bind / Replace</p>
        <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
          <USelect v-model="selectedIotDeviceId" class="md:col-span-2" :items="deviceOptions" value-key="value" placeholder="Select NEW/SPARE IoT device" :ui="bindSelectUi" />
          <UInput v-model="reason" placeholder="Bind/replace reason (optional)" class="md:col-span-2" :ui="{ base: 'h-10 bg-white text-slate-900 placeholder:text-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 ring-1 ring-slate-300 dark:ring-slate-500' }" />
        </div>
        <div class="mt-3 flex items-center gap-2">
          <UButton color="primary" class="text-white" :loading="saving" :disabled="!selectedIotDeviceId || loading" @click="submitBindReplace">{{ actionLabel }}</UButton>
          <UButton v-if="isBound && allowUnbind" color="error" variant="soft" :loading="saving" :disabled="loading" @click="requestUnbindConfirm">Unbind</UButton>
          <UButton color="neutral" variant="soft" icon="i-lucide-history" @click="openHistory">History</UButton>
        </div>
      </div>
    </div>
  </UCard>

  <UModal v-else :open="open" :ui="{ content: 'sm:max-w-4xl' }" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold text-slate-600 dark:text-slate-300">{{ modalTitle }}</h3>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emit('update:open', false)" />
          </div>
        </template>

        <div class="space-y-3">
          <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

          <div :class="currentBindingCardClass">
            <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">mac Address</p>
                <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.iotDevice?.macAddress || 'Not bound' }}</p>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Device UID</p>
                <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.iotDevice?.deviceUid || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Status</p>
                <p class="mt-0.5 text-sm font-semibold" :class="currentBindingStatusClass">{{ isBound ? 'BOUND' : 'UNASSIGNED' }}</p>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Name</p>
                <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.iotDevice?.name || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Model</p>
                <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.iotDevice?.model || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Binding At</p>
                <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.startedAt ? new Date(detail.activeBinding.startedAt).toLocaleString() : '-' }}</p>
              </div>
              <div class="md:col-span-3">
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Reason</p>
                <p class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ detail?.activeBinding?.reason || '-' }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Bind / Replace</p>
            <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
              <USelect
                v-model="selectedIotDeviceId"
                class="md:col-span-2"
                :items="deviceOptions"
                value-key="value"
                placeholder="Select NEW/SPARE IoT device"
                :ui="bindSelectUi"
              />
              <UInput
                v-model="reason"
                placeholder="Bind/replace reason (optional)"
                class="md:col-span-2"
                :ui="{ base: 'h-10 bg-white text-slate-900 placeholder:text-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 ring-1 ring-slate-300 dark:ring-slate-500' }"
              />
            </div>
            <div class="mt-3 flex items-center gap-2">
              <UButton color="primary" class="text-white" :loading="saving" :disabled="!selectedIotDeviceId || loading" @click="submitBindReplace">{{ actionLabel }}</UButton>
              <UButton v-if="isBound && allowUnbind" color="error" variant="soft" :loading="saving" :disabled="loading" @click="requestUnbindConfirm">Unbind</UButton>
              <UButton color="neutral" variant="soft" icon="i-lucide-history" @click="openHistory">History</UButton>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="unbindConfirmOpen" :ui="{ content: 'sm:max-w-md' }">
    <template #content>
      <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirm Unbind IoT</h3>
        </template>
        <div class="space-y-2">
          <p class="text-sm text-slate-700 dark:text-slate-200">Are you sure you want to unbind this IoT device from the asset?</p>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Asset:
            <span class="font-semibold text-slate-900 dark:text-slate-100">
              {{ props.assetName || '-' }}
            </span>
          </p>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Device:
            <span class="font-semibold text-slate-900 dark:text-slate-100">
              {{ detail?.activeBinding?.iotDevice?.macAddress || '-' }}
            </span>
          </p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="unbindConfirmOpen = false">Cancel</UButton>
            <UButton
              color="error"
              :loading="saving"
              @click="() => { unbindConfirmOpen = false; submitUnbind() }"
            >
              Confirm Unbind
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
