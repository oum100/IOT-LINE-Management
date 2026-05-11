<script setup lang="ts">
type ProductRow = {
  id: string
  code: string
  name: string
  kind: string
  amount: number
  quantity: number | null
  serviceUnit: string | null
  active: boolean
}

type OfferRow = {
  id: string
  productId: string
  pricingType: string
  amount: number
  priority: number
  effectiveFrom: string
  effectiveTo?: string | null
  active: boolean
  reason?: string | null
  product?: { id: string; code: string; name: string } | null
}

type ScopeOption = { id: string; code: string; name: string; merchantAccountId?: string | null }

const props = defineProps<{
  open: boolean
  assetId: string
  assetName?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'changed'): void
}>()

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')

const products = ref<ProductRow[]>([])
const availableProducts = ref<ProductRow[]>([])
const bindingHistory = ref<Array<{
  id: string
  eventType: 'BOUND' | 'UNBOUND' | 'REBOUND'
  active: boolean
  eventAt: string
  product?: { id: string; code: string; name: string } | null
}>>([])
const current = ref<OfferRow[]>([])
const upcoming = ref<OfferRow[]>([])
const history = ref<OfferRow[]>([])
const promoTab = ref<'current' | 'upcoming' | 'history'>('current')
const sectionTab = ref<'binding' | 'promotion'>('promotion')

const scope = ref<{ tenant: ScopeOption | null; merchant: ScopeOption | null; branch: ScopeOption | null }>({
  tenant: null,
  merchant: null,
  branch: null
})
const deviceName = ref('-')

const setPromoOpen = ref(false)
const setPromoSaving = ref(false)
const setPromoProductId = ref('')
const setPromoError = ref('')

const bindOpen = ref(false)
const bindProductId = ref('')
const bindError = ref('')

const unbindOpen = ref(false)
const unbindProductId = ref('')
const unbindProductName = ref('')
const unbindProductCode = ref('')
const unbindError = ref('')

const staticQrOpen = ref(false)
const staticQrLoading = ref(false)
const staticQrError = ref('')
const staticQrCopyDone = ref(false)
const staticQrData = ref<any>(null)

const selectedPromoProduct = computed(() => products.value.find(p => p.id === setPromoProductId.value) || null)
const promoRows = computed(() => (
  promoTab.value === 'current' ? current.value : promoTab.value === 'upcoming' ? upcoming.value : history.value
))
const modalTitle = computed(() => `Product Promo · ${props.assetName || '-'}`)

function fmtDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-'
}

function fmtTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString() : '-'
}

function serviceLabel(row: ProductRow) {
  return `${row.quantity ?? '-'} ${String(row.serviceUnit || 'unit').toLowerCase()}`
}

async function loadData() {
  if (!props.assetId) return
  loading.value = true
  error.value = ''
  message.value = ''
  try {
    const [boundRes, availableRes, bindingHistoryRes, offerRes] = await Promise.all([
      $fetch<any>(`/api/admin/assets/${props.assetId}/products/bound`),
      $fetch<{ items: ProductRow[] }>(`/api/admin/assets/${props.assetId}/products/available`),
      $fetch<{ items: any[] }>(`/api/admin/assets/${props.assetId}/products/binding-history`),
      $fetch<{ current: OfferRow[]; upcoming: OfferRow[]; history: OfferRow[] }>(`/api/admin/assets/${props.assetId}/products`)
    ])
    products.value = boundRes.items || []
    scope.value = boundRes.scope || { tenant: null, merchant: null, branch: null }
    deviceName.value = boundRes.deviceName || '-'
    availableProducts.value = availableRes.items || []
    bindingHistory.value = bindingHistoryRes.items || []
    current.value = offerRes.current || []
    upcoming.value = offerRes.upcoming || []
    history.value = offerRes.history || []
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Failed to load product/promotion data'
  } finally {
    loading.value = false
  }
}

function openBindModal() {
  bindError.value = ''
  bindProductId.value = availableProducts.value[0]?.id || ''
  bindOpen.value = true
}

async function submitBind() {
  if (!props.assetId || !bindProductId.value) return
  saving.value = true
  bindError.value = ''
  error.value = ''
  try {
    await $fetch(`/api/admin/assets/${props.assetId}/products/${bindProductId.value}`, { method: 'POST' })
    bindOpen.value = false
    message.value = 'Product bound.'
    await loadData()
    emit('changed')
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.message || 'Failed to bind product'
    bindError.value = msg
    error.value = msg
  } finally {
    saving.value = false
  }
}

function openUnbindModal(row: ProductRow) {
  unbindError.value = ''
  unbindProductId.value = row.id
  unbindProductName.value = row.name
  unbindProductCode.value = row.code
  unbindOpen.value = true
}

async function submitUnbind() {
  if (!props.assetId || !unbindProductId.value) return
  saving.value = true
  unbindError.value = ''
  error.value = ''
  try {
    await $fetch(`/api/admin/assets/${props.assetId}/products/${unbindProductId.value}`, { method: 'DELETE' })
    unbindOpen.value = false
    message.value = 'Product unbound.'
    await loadData()
    emit('changed')
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.message || 'Failed to unbind product'
    unbindError.value = msg
    error.value = msg
  } finally {
    saving.value = false
  }
}

function openSetPromo(row: ProductRow) {
  setPromoError.value = ''
  setPromoProductId.value = row.id
  setPromoOpen.value = true
}

async function submitSetPromotion(payload: {
  productId: string
  branchId: string
  amount: number
  effectiveFrom: string
  effectiveTo: string | null
  priority: number
  replaceActive: boolean
}) {
  if (!props.assetId) return
  setPromoSaving.value = true
  setPromoError.value = ''
  error.value = ''
  try {
    await $fetch(`/api/admin/assets/${props.assetId}/products`, {
      method: 'POST',
      body: {
        productId: payload.productId,
        pricingType: 'PROMOTION',
        amount: Number(payload.amount),
        priority: payload.priority,
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo,
        reason: 'asset-product-promo'
      }
    })
    setPromoOpen.value = false
    message.value = 'Promotion created.'
    await loadData()
    emit('changed')
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.message || 'Failed to set promotion'
    setPromoError.value = msg
    error.value = msg
  } finally {
    setPromoSaving.value = false
  }
}

async function openStaticQr(row: ProductRow) {
  if (!props.assetId) return
  staticQrOpen.value = true
  staticQrLoading.value = true
  staticQrError.value = ''
  staticQrCopyDone.value = false
  try {
    staticQrData.value = await $fetch(`/api/admin/assets/${props.assetId}/products/${row.id}-static-qr`)
  } catch (err: any) {
    staticQrData.value = null
    staticQrError.value = err?.data?.statusMessage || err?.message || 'Failed to build static QR'
  } finally {
    staticQrLoading.value = false
  }
}

async function copyStaticQrText() {
  const text = staticQrData.value?.qrText || ''
  if (!text) return
  await navigator.clipboard.writeText(text)
  staticQrCopyDone.value = true
  setTimeout(() => { staticQrCopyDone.value = false }, 1200)
}

watch(() => props.open, (v) => {
  if (v) void loadData()
})
</script>

<template>
  <UModal :open="open" :ui="{ content: 'sm:max-w-7xl max-h-[90vh] overflow-hidden' }" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 h-[90vh] flex flex-col overflow-hidden', body: 'min-h-0 flex-1 overflow-y-auto' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ modalTitle }}</h3>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emit('update:open', false)" />
          </div>
        </template>

        <div class="space-y-3 pr-1 pb-3">
          <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
          <UAlert v-if="message" color="success" variant="soft" icon="i-lucide-badge-check" :title="message" />

          <div class="flex items-center justify-between gap-3 text-sm">
            <div class="flex flex-wrap items-center gap-5">
              <p class="text-slate-700 dark:text-slate-200">Device Name: <span class="font-semibold text-slate-900 dark:text-slate-100">{{ deviceName }}</span></p>
              <p class="text-slate-700 dark:text-slate-200">Tenant: <span class="font-semibold text-slate-900 dark:text-slate-100">{{ scope.tenant?.name || '-' }}</span></p>
              <p class="text-slate-700 dark:text-slate-200">Merchant: <span class="font-semibold text-slate-900 dark:text-slate-100">{{ scope.merchant?.name || '-' }}</span></p>
              <p class="text-slate-700 dark:text-slate-200">Branch: <span class="font-semibold text-slate-900 dark:text-slate-100">{{ scope.branch?.name || '-' }}</span></p>
            </div>
            <p class="text-slate-600 dark:text-slate-300">{{ products.length }} items</p>
          </div>

          <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Product List</p>
              <UButton color="primary" variant="soft" size="sm" icon="i-lucide-link" :disabled="!availableProducts.length" @click="openBindModal">Bind Product</UButton>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-slate-100/80 dark:bg-slate-800/80">
                  <tr class="text-center">
                    <th class="px-3 py-2">Name</th>
                    <th class="px-3 py-2">Type</th>
                    <th class="px-3 py-2">Price</th>
                    <th class="px-3 py-2">Service</th>
                    <th class="px-3 py-2">Status</th>
                    <th class="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in products" :key="row.id" class="border-t border-slate-200 text-center dark:border-slate-700">
                    <td class="px-3 py-2">
                      <p class="font-medium text-slate-900 dark:text-slate-100">{{ row.name }}</p>
                      <p class="text-slate-600 dark:text-slate-300">{{ row.code }}</p>
                    </td>
                    <td class="px-3 py-2">{{ row.kind }}</td>
                    <td class="px-3 py-2">{{ row.amount }}</td>
                    <td class="px-3 py-2">{{ serviceLabel(row) }}</td>
                    <td class="px-3 py-2">
                      <UBadge :color="row.active ? 'success' : 'error'" variant="soft" size="sm">{{ row.active ? 'ACTIVE' : 'INACTIVE' }}</UBadge>
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex items-center justify-center gap-1">
                        <UButton icon="i-lucide-percent" color="warning" variant="ghost" size="sm" title="Set Promotion" @click="openSetPromo(row)" />
                        <UButton icon="i-lucide-qr-code" color="primary" variant="ghost" size="sm" title="Show Static ThaiQR" @click="openStaticQr(row)" />
                        <UButton icon="i-lucide-unlink" color="error" variant="ghost" size="sm" title="Unbind Product" @click="openUnbindModal(row)" />
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!loading && !products.length">
                    <td colspan="6" class="px-3 py-4 text-center text-slate-500 dark:text-slate-400">No bound products.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2">
            <UButton size="sm" :variant="sectionTab === 'binding' ? 'solid' : 'soft'" color="neutral" @click="sectionTab = 'binding'">Product Bind</UButton>
            <UButton size="sm" :variant="sectionTab === 'promotion' ? 'solid' : 'soft'" color="neutral" @click="sectionTab = 'promotion'">Promotion</UButton>
          </div>

          <div v-if="sectionTab === 'binding'" class="space-y-3">

            <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Product Bind/Unbind History</p>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-slate-100/80 dark:bg-slate-800/80">
                    <tr class="text-center">
                      <th class="px-3 py-2">Event</th>
                      <th class="px-3 py-2">Product</th>
                      <th class="px-3 py-2">Event At</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in bindingHistory" :key="item.id" class="border-t border-slate-200 text-center dark:border-slate-700">
                      <td class="px-3 py-2">{{ item.eventType }}</td>
                      <td class="px-3 py-2">{{ item.product?.name || '-' }} ({{ item.product?.code || '-' }})</td>
                      <td class="px-3 py-2">
                        <p>{{ fmtDate(item.eventAt) }}</p>
                        <p class="text-slate-600 dark:text-slate-300">{{ fmtTime(item.eventAt) }}</p>
                      </td>
                    </tr>
                    <tr v-if="!bindingHistory.length">
                      <td colspan="3" class="px-3 py-4 text-center text-slate-500 dark:text-slate-400">No history.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div v-else class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Promotion</p>
              <div class="flex items-center gap-2">
                <UButton size="sm" :variant="promoTab === 'current' ? 'solid' : 'soft'" color="neutral" @click="promoTab = 'current'">Current</UButton>
                <UButton size="sm" :variant="promoTab === 'upcoming' ? 'solid' : 'soft'" color="neutral" @click="promoTab = 'upcoming'">Upcoming</UButton>
                <UButton size="sm" :variant="promoTab === 'history' ? 'solid' : 'soft'" color="neutral" @click="promoTab = 'history'">History</UButton>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-slate-100/80 dark:bg-slate-800/80">
                  <tr class="text-center">
                    <th class="px-3 py-2">Product</th>
                    <th class="px-3 py-2">Price</th>
                    <th class="px-3 py-2">Start</th>
                    <th class="px-3 py-2">End</th>
                    <th class="px-3 py-2">Priority</th>
                    <th class="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in promoRows" :key="item.id" class="border-t border-slate-200 text-center dark:border-slate-700">
                    <td class="px-3 py-2">{{ item.product?.name || '-' }} ({{ item.product?.code || '-' }})</td>
                    <td class="px-3 py-2">{{ item.amount }}</td>
                    <td class="px-3 py-2">
                      <p>{{ fmtDate(item.effectiveFrom) }}</p>
                      <p class="text-slate-600 dark:text-slate-300">{{ fmtTime(item.effectiveFrom) }}</p>
                    </td>
                    <td class="px-3 py-2">
                      <p>{{ fmtDate(item.effectiveTo) }}</p>
                      <p class="text-slate-600 dark:text-slate-300">{{ fmtTime(item.effectiveTo) }}</p>
                    </td>
                    <td class="px-3 py-2">P{{ item.priority }}</td>
                    <td class="px-3 py-2">{{ item.reason || '-' }}</td>
                  </tr>
                  <tr v-if="!promoRows.length">
                    <td colspan="6" class="px-3 py-4 text-center text-slate-500 dark:text-slate-400">No promotions.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>

  <PromotionSetPromotionModal
    v-model:open="setPromoOpen"
    :saving="setPromoSaving"
    :error="setPromoError"
    :asset="{ name: assetName || '-', code: '' }"
    :product="selectedPromoProduct ? { id: selectedPromoProduct.id, name: selectedPromoProduct.name, code: selectedPromoProduct.code, amount: selectedPromoProduct.amount } : null"
    :tenants="scope.tenant ? [scope.tenant] : []"
    :merchants="scope.merchant ? [scope.merchant] : []"
    :branches="scope.branch ? [scope.branch] : []"
    :default-merchant-id="scope.merchant?.id || ''"
    :default-branch-id="scope.branch?.id || ''"
    @submit="submitSetPromotion"
  />

  <AssetStaticThaiQrModal
    v-model:open="staticQrOpen"
    :loading="staticQrLoading"
    :error="staticQrError"
    :data="staticQrData"
    :copy-done="staticQrCopyDone"
    @copy="copyStaticQrText"
  />

  <AssetProductBindModal
    v-model:open="bindOpen"
    v-model="bindProductId"
    :loading="saving"
    :error="bindError"
    :options="availableProducts"
    @submit="submitBind"
  />

  <AssetProductUnbindModal
    v-model:open="unbindOpen"
    :loading="saving"
    :error="unbindError"
    :product-name="unbindProductName"
    :product-code="unbindProductCode"
    @confirm="submitUnbind"
  />
</template>
