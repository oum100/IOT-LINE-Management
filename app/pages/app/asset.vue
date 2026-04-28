<script setup lang="ts">
definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})

type AssetWorkspaceResponse = {
  tenant?: { id: string; code: string; name: string } | null
  selectedMerchantId: string
  selectedBranchId: string
  selectedAssetId: string
  selectedAssetType: string
  assetTypes: string[]
  merchants: Array<{ id: string; code: string; name: string }>
  branches: Array<{ id: string; code: string; name: string; merchantAccountId: string | null }>
  assets: Array<{
    id: string
    code: string
    name: string
    status: string
    kind: string
    branchId: string
    updatedAt: string
  }>
  products: Array<{
    id: string
    code: string
    name: string
    kind: string
    amount: number | null
    durationMinutes: number | null
    active: boolean
  }>
  selectedAsset?: {
    id: string
    code: string
    name: string
    kind: string
    status: string
    prices: Array<{
      id: string
      amount: number
      durationMinutes: number
      active: boolean
      orderCount: number
      canUnbind: boolean
      product: {
        id: string
        code: string
        name: string
        active: boolean
        amount: number | null
        durationMinutes: number | null
      } | null
    }>
  } | null
  activeBinding?: {
    id: string
    iotDevice: {
      id: string
      deviceUid: string | null
      macAddress: string
      status: string
    } | null
    machineUnit: {
      id: string
      serialNo: string
      brand: string | null
      model: string | null
      status: string
    } | null
  } | null
}

const selectedMerchantId = ref('')
const selectedBranchId = ref('')
const selectedAssetId = ref('')
const selectedAssetType = ref('')

const bindProductOpen = ref(false)
const bindProductSaving = ref(false)
const bindProductError = ref('')
const bindProductId = ref('')
const unbindProductSavingId = ref('')
const unbindProductError = ref('')

const bindDeviceOpen = ref(false)
const bindDeviceSaving = ref(false)
const bindDeviceError = ref('')
const bindDeviceId = ref('')
const availableIotDevices = ref<Array<{ id: string; deviceUid: string | null; macAddress: string; name: string | null; model: string | null }>>([])

const bindMachineOpen = ref(false)
const bindMachineSaving = ref(false)
const bindMachineError = ref('')
const bindMachineId = ref('')
const availableMachineUnits = ref<Array<{ id: string; serialNo: string; brand: string | null; model: string | null }>>([])

const queryParams = computed(() => ({
  merchantAccountId: selectedMerchantId.value || undefined,
  branchId: selectedBranchId.value || undefined,
  assetType: selectedAssetType.value || undefined,
  assetId: selectedAssetId.value || undefined
}))

const { data, pending, error, refresh } = await useFetch<AssetWorkspaceResponse>('/api/app/tenant-detail', {
  query: queryParams
})

const merchants = computed(() => data.value?.merchants || [])
const branches = computed(() => data.value?.branches || [])
const assets = computed(() => data.value?.assets || [])
const products = computed(() => data.value?.products || [])
const assetTypes = computed(() => data.value?.assetTypes || [])
const selectedAsset = computed(() => data.value?.selectedAsset || null)
const activeBinding = computed(() => data.value?.activeBinding || null)

const activeBoundProductIds = computed(() => {
  if (!selectedAsset.value) return new Set<string>()
  return new Set(
    selectedAsset.value.prices
      .filter(entry => entry.active && entry.product?.id)
      .map(entry => entry.product!.id)
  )
})

const bindableProducts = computed(() => {
  const assetKind = selectedAsset.value?.kind || ''
  if (!assetKind) return []
  return products.value.filter(item => item.active && item.kind === assetKind && !activeBoundProductIds.value.has(item.id))
})

watch(() => data.value?.selectedMerchantId, (v) => {
  if (v && !selectedMerchantId.value) selectedMerchantId.value = v
}, { immediate: true })

watch(() => data.value?.selectedAssetType, (v) => {
  if (v && !selectedAssetType.value) selectedAssetType.value = v
}, { immediate: true })

watch(() => data.value?.selectedBranchId, (v) => {
  if (v && !selectedBranchId.value) selectedBranchId.value = v
}, { immediate: true })

watch(() => data.value?.selectedAssetId, (v) => {
  if (v && !selectedAssetId.value) selectedAssetId.value = v
}, { immediate: true })

watch(merchants, (rows) => {
  if (selectedMerchantId.value && !rows.some(item => item.id === selectedMerchantId.value)) {
    selectedMerchantId.value = ''
  }
}, { immediate: true })

watch(assets, (rows) => {
  if (selectedAssetId.value && !rows.some(item => item.id === selectedAssetId.value)) {
    selectedAssetId.value = ''
  }
}, { immediate: true })

watch(branches, (rows) => {
  if (selectedBranchId.value && !rows.some(item => item.id === selectedBranchId.value)) {
    selectedBranchId.value = ''
  }
}, { immediate: true })

function statusTextClass(status?: string | null) {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'VERIFIED' || s === 'IN_USE') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'SUSPENDED' || s === 'MAINTENANCE' || s === 'SPARE') return 'text-amber-600 dark:text-amber-400'
  if (s === 'DISABLED' || s === 'INACTIVE' || s === 'OFFLINE') return 'text-rose-600 dark:text-rose-400'
  return 'text-slate-700 dark:text-slate-200'
}

async function openCreateAsset() {
  const tenantId = data.value?.tenant?.id || ''
  if (!tenantId) return
  const query = new URLSearchParams()
  query.set('tenantId', tenantId)
  if (selectedMerchantId.value) query.set('merchantAccountId', selectedMerchantId.value)
  await navigateTo(`/admin/assets?${query.toString()}`)
}

async function openBindDeviceModal() {
  if (!selectedAssetId.value) return
  bindDeviceSaving.value = true
  bindDeviceError.value = ''
  try {
    const result = await $fetch<{ items: Array<{ id: string; deviceUid: string | null; macAddress: string; name: string | null; model: string | null }> }>(`/api/app/assets/${selectedAssetId.value}/available-iot-devices`)
    availableIotDevices.value = result.items || []
    bindDeviceId.value = availableIotDevices.value[0]?.id || ''
    bindDeviceOpen.value = true
  } catch (err) {
    bindDeviceError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to load spare IoT devices'
  } finally {
    bindDeviceSaving.value = false
  }
}

function closeBindDeviceModal() {
  bindDeviceOpen.value = false
  bindDeviceSaving.value = false
  bindDeviceError.value = ''
}

async function submitBindDevice() {
  if (!selectedAssetId.value || !bindDeviceId.value) return
  bindDeviceSaving.value = true
  bindDeviceError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/replace-device`, {
      method: 'POST',
      body: {
        iotDeviceId: bindDeviceId.value,
        reason: activeBinding.value?.iotDevice ? 'portal-replace-device' : 'portal-bind-device'
      }
    })
    await refresh()
    closeBindDeviceModal()
  } catch (err) {
    bindDeviceError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to bind IoT device'
  } finally {
    bindDeviceSaving.value = false
  }
}

async function openBindMachineModal() {
  if (!selectedAssetId.value) return
  bindMachineSaving.value = true
  bindMachineError.value = ''
  try {
    const result = await $fetch<{ items: Array<{ id: string; serialNo: string; brand: string | null; model: string | null }> }>(`/api/app/assets/${selectedAssetId.value}/available-machine-units`)
    availableMachineUnits.value = result.items || []
    bindMachineId.value = availableMachineUnits.value[0]?.id || ''
    bindMachineOpen.value = true
  } catch (err) {
    bindMachineError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to load spare machine units'
  } finally {
    bindMachineSaving.value = false
  }
}

function closeBindMachineModal() {
  bindMachineOpen.value = false
  bindMachineSaving.value = false
  bindMachineError.value = ''
}

async function submitBindMachine() {
  if (!selectedAssetId.value || !bindMachineId.value) return
  bindMachineSaving.value = true
  bindMachineError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/replace-machine`, {
      method: 'POST',
      body: {
        machineUnitId: bindMachineId.value,
        reason: activeBinding.value?.machineUnit ? 'portal-replace-machine' : 'portal-bind-machine'
      }
    })
    await refresh()
    closeBindMachineModal()
  } catch (err) {
    bindMachineError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to bind machine unit'
  } finally {
    bindMachineSaving.value = false
  }
}

function openAssetProductBinding() {
  if (!selectedAssetId.value) return
  bindProductError.value = ''
  bindProductId.value = bindableProducts.value[0]?.id || ''
  bindProductOpen.value = true
}

function closeBindProduct() {
  bindProductOpen.value = false
  bindProductSaving.value = false
  bindProductError.value = ''
}

async function submitBindProduct() {
  bindProductSaving.value = true
  bindProductError.value = ''
  try {
    if (!selectedAssetId.value) throw new Error('Please select an asset first.')
    if (!bindProductId.value) throw new Error('Please select a product.')
    await $fetch(`/api/app/assets/${selectedAssetId.value}/products`, {
      method: 'POST',
      body: { productId: bindProductId.value }
    })
    await refresh()
    closeBindProduct()
  } catch (err) {
    bindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to bind product'
  } finally {
    bindProductSaving.value = false
  }
}

async function unbindProduct(productId: string) {
  if (!selectedAssetId.value || !productId) return
  unbindProductSavingId.value = productId
  unbindProductError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/products/${productId}`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (err) {
    unbindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to unbind product'
  } finally {
    unbindProductSavingId.value = ''
  }
}

async function rebindProduct(productId: string) {
  if (!selectedAssetId.value || !productId) return
  unbindProductSavingId.value = productId
  unbindProductError.value = ''
  try {
    await $fetch(`/api/app/assets/${selectedAssetId.value}/products`, {
      method: 'POST',
      body: { productId }
    })
    await refresh()
  } catch (err) {
    unbindProductError.value = (err as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (err as Error).message || 'Failed to rebind product'
  } finally {
    unbindProductSavingId.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="Failed to load asset workspace"
      :description="error.message"
    />

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">Asset Workspace</h3>
        <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ selectedAsset?.name || 'Assets' }}</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ selectedAsset ? `Selected asset: ${selectedAsset.name} (${selectedAsset.code})` : 'Select an asset from the list to start managing details and bindings.' }}
        </p>
      </div>

      <div class="flex flex-1 flex-wrap items-start justify-end gap-3">
        <div class="flex w-full max-w-[260px] flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Merchant</label>
          <select
            v-model="selectedMerchantId"
            class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">All merchants</option>
            <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>

        <div class="flex w-full max-w-[260px] flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Branch</label>
          <select
            v-model="selectedBranchId"
            class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">All branches</option>
            <option v-for="item in branches" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>

        <div class="flex w-full max-w-[220px] flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Asset Type</label>
          <select
            v-model="selectedAssetType"
            class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">All types</option>
            <option v-for="item in assetTypes" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-3 lg:items-stretch">
      <UCard :ui="{ root: 'min-h-[760px] bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700', body: 'h-full p-3 flex flex-col' }" class="lg:col-span-1">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Asset List</p>
          <div class="flex items-center gap-2">
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ assets.length }} items</p>
            <UButton icon="i-lucide-plus" color="primary" variant="soft" size="xs" @click="openCreateAsset" />
          </div>
        </div>
        <div v-if="pending" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
        <div v-else-if="!assets.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No assets.</div>
        <div v-else class="flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th class="px-3 py-2 text-left">Name</th>
                <th class="px-3 py-2 text-left">Code</th>
                <th class="px-3 py-2 text-left">Type</th>
                <th class="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in assets"
                :key="item.id"
                class="cursor-pointer border-t border-slate-200 text-slate-700 transition dark:border-slate-700 dark:text-slate-200"
                :class="selectedAssetId === item.id ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'"
                @click="selectedAssetId = item.id"
              >
                <td class="px-3 py-2 font-medium">{{ item.name }}</td>
                <td class="px-3 py-2 text-xs">{{ item.code }}</td>
                <td class="px-3 py-2">{{ item.kind }}</td>
                <td class="px-3 py-2">
                  <UBadge :color="item.status === 'ACTIVE' ? 'success' : (item.status === 'MAINTENANCE' ? 'warning' : 'error')" variant="soft" size="sm">
                    {{ item.status }}
                  </UBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <div class="grid min-h-[560px] grid-rows-[auto_1fr] gap-3 lg:col-span-2">
        <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <p class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Asset Detail</p>
          <div v-if="pending" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          <div v-else-if="!selectedAsset" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No asset selected.</div>
          <div v-else class="space-y-3">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Code</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ selectedAsset.code }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Name</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ selectedAsset.name }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Type</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ selectedAsset.kind }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Status</p>
                <p class="text-sm font-semibold" :class="statusTextClass(selectedAsset.status)">{{ selectedAsset.status }}</p>
              </div>
            </div>
            <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div class="mb-2 flex items-center justify-between">
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Products bound to this asset</p>
                <div class="flex items-center gap-2">
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ selectedAsset.prices.length }} items</p>
                  <UButton
                    icon="i-lucide-link"
                    color="primary"
                    variant="soft"
                    size="2xs"
                    :disabled="!selectedAssetId"
                    @click="openAssetProductBinding"
                  >
                    Bind Product
                  </UButton>
                </div>
              </div>
              <div v-if="!selectedAsset.prices.length" class="text-sm text-slate-500 dark:text-slate-400">No products linked.</div>
              <div v-else class="overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
                <div v-if="unbindProductError" class="border-b border-slate-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-slate-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {{ unbindProductError }}
                </div>
                <table class="min-w-full text-sm">
                  <thead class="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th class="px-3 py-2 text-left">Product</th>
                      <th class="px-3 py-2 text-right">Price</th>
                      <th class="px-3 py-2 text-right">Time</th>
                      <th class="px-3 py-2 text-right">Orders</th>
                      <th class="px-3 py-2 text-left">Binding</th>
                      <th class="px-3 py-2 text-left">Product</th>
                      <th class="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="price in selectedAsset.prices"
                      :key="price.id"
                      class="border-t border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      <td class="px-3 py-2 font-medium">{{ price.product?.name || '-' }}</td>
                      <td class="px-3 py-2 text-right">{{ price.product?.amount ?? price.amount }}</td>
                      <td class="px-3 py-2 text-right">{{ price.product?.durationMinutes ?? price.durationMinutes }}m</td>
                      <td class="px-3 py-2 text-right">{{ price.orderCount }}</td>
                      <td class="px-3 py-2">
                        <UBadge :color="price.active ? 'success' : 'warning'" variant="soft" size="sm" class="font-semibold">
                          {{ price.active ? 'BOUND' : 'INACTIVE' }}
                        </UBadge>
                      </td>
                      <td class="px-3 py-2">
                        <UBadge :color="price.product?.active ? 'success' : 'error'" variant="soft" size="sm" class="font-semibold">
                          {{ price.product?.active ? 'ACTIVE' : 'DISABLED' }}
                        </UBadge>
                      </td>
                      <td class="px-3 py-2 text-center">
                        <UButton
                          :icon="price.active ? 'i-lucide-unlink-2' : 'i-lucide-link-2'"
                          :color="price.active ? 'error' : 'primary'"
                          variant="ghost"
                          size="sm"
                          class="h-8 w-8"
                          :loading="unbindProductSavingId === (price.product?.id || '')"
                          :disabled="price.active ? (!price.product?.id || !price.canUnbind) : (!price.product?.id || !price.product?.active)"
                          :title="price.active
                            ? (price.canUnbind ? 'Unbind' : 'Cannot unbind: used in orders')
                            : (price.product?.active ? 'Rebind' : 'Cannot rebind: product is disabled')"
                          @click="price.product?.id ? (price.active ? unbindProduct(price.product.id) : rebindProduct(price.product.id)) : null"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </UCard>

        <div class="grid h-full gap-3 md:grid-cols-2">
          <UCard :ui="{ root: 'h-full bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Device Detail</p>
              <UButton
                :icon="activeBinding?.iotDevice ? 'i-lucide-refresh-ccw' : 'i-lucide-link'"
                color="primary"
                variant="soft"
                size="xs"
                :title="activeBinding?.iotDevice ? 'Replace Device' : 'Bind Device'"
                :disabled="!selectedAssetId"
                @click="openBindDeviceModal"
              />
            </div>
            <div v-if="bindDeviceError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {{ bindDeviceError }}
            </div>
            <div v-if="!activeBinding?.iotDevice" class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No bound device.</div>
            <div v-else class="space-y-2">
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Device UID</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ activeBinding.iotDevice.deviceUid || '-' }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">MAC</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ activeBinding.iotDevice.macAddress }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Status</p>
                <p class="text-sm font-semibold" :class="statusTextClass(activeBinding.iotDevice.status)">{{ activeBinding.iotDevice.status }}</p>
              </div>
            </div>
          </UCard>

          <UCard :ui="{ root: 'h-full bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Machine Detail</p>
              <UButton
                :icon="activeBinding?.machineUnit ? 'i-lucide-refresh-ccw' : 'i-lucide-link'"
                color="primary"
                variant="soft"
                size="xs"
                :title="activeBinding?.machineUnit ? 'Replace Machine' : 'Bind Machine'"
                :disabled="!selectedAssetId"
                @click="openBindMachineModal"
              />
            </div>
            <div v-if="bindMachineError" class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {{ bindMachineError }}
            </div>
            <div v-if="!activeBinding?.machineUnit" class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No bound machine.</div>
            <div v-else class="space-y-2">
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Serial No</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ activeBinding.machineUnit.serialNo }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Brand/Model</p>
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ activeBinding.machineUnit.brand || '-' }} / {{ activeBinding.machineUnit.model || '-' }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p class="text-xs text-slate-500 dark:text-slate-400">Status</p>
                <p class="text-sm font-semibold" :class="statusTextClass(activeBinding.machineUnit.status)">{{ activeBinding.machineUnit.status }}</p>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>

    <UModal v-model:open="bindProductOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Bind Product to Asset</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeBindProduct" />
            </div>
          </template>

          <div class="space-y-3">
            <UAlert v-if="bindProductError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="bindProductError" />
            <UFormField>
              <template #label>
                <span>Product <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="bindProductId"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select product</option>
                <option v-for="item in bindableProducts" :key="item.id" :value="item.id">
                  {{ item.name }} · {{ item.amount ?? '-' }} THB / {{ item.durationMinutes ?? '-' }}m
                </option>
              </select>
            </UFormField>
            <p v-if="!bindableProducts.length" class="text-xs text-slate-500 dark:text-slate-400">
              No available active products for this asset type.
            </p>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeBindProduct">Cancel</UButton>
              <UButton color="primary" :loading="bindProductSaving" :disabled="!bindProductId" @click="submitBindProduct">Bind Product</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="bindDeviceOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ activeBinding?.iotDevice ? 'Replace IoT Device' : 'Bind IoT Device' }}</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeBindDeviceModal" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="bindDeviceError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="bindDeviceError" />
            <UFormField>
              <template #label>
                <span>Select Spare IoT Device <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="bindDeviceId"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select IoT device</option>
                <option v-for="item in availableIotDevices" :key="item.id" :value="item.id">
                  {{ item.name || item.deviceUid || item.macAddress }} · {{ item.macAddress }}
                </option>
              </select>
            </UFormField>
            <p v-if="!availableIotDevices.length" class="text-xs text-slate-500 dark:text-slate-400">No spare IoT devices available.</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeBindDeviceModal">Cancel</UButton>
              <UButton color="primary" :loading="bindDeviceSaving" :disabled="!bindDeviceId" @click="submitBindDevice">{{ activeBinding?.iotDevice ? 'Replace' : 'Bind' }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="bindMachineOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ activeBinding?.machineUnit ? 'Replace Machine Unit' : 'Bind Machine Unit' }}</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeBindMachineModal" />
            </div>
          </template>
          <div class="space-y-3">
            <UAlert v-if="bindMachineError" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="bindMachineError" />
            <UFormField>
              <template #label>
                <span>Select Spare Machine Unit <span class="text-rose-500">*</span></span>
              </template>
              <select
                v-model="bindMachineId"
                class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select machine unit</option>
                <option v-for="item in availableMachineUnits" :key="item.id" :value="item.id">
                  {{ item.serialNo }}{{ item.brand || item.model ? ` · ${item.brand || '-'} / ${item.model || '-'}` : '' }}
                </option>
              </select>
            </UFormField>
            <p v-if="!availableMachineUnits.length" class="text-xs text-slate-500 dark:text-slate-400">No spare machine units available.</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="closeBindMachineModal">Cancel</UButton>
              <UButton color="primary" :loading="bindMachineSaving" :disabled="!bindMachineId" @click="submitBindMachine">{{ activeBinding?.machineUnit ? 'Replace' : 'Bind' }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
