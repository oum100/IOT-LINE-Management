<script setup lang="ts">

definePageMeta({ layout: 'tenant', middleware: 'portal-auth' })

type Tab = 'current' | 'upcoming' | 'history'
type OfferRow = {
  id: string
  amount: number
  priority: number
  effectiveFrom: string
  effectiveTo?: string | null
  updatedAt?: string | null
  active: boolean
  reason?: string | null
  asset?: { id: string; code: string; name: string; branch?: { id: string; code: string; name: string; merchantAccount?: { id: string; code: string; name: string } | null } | null } | null
  product?: { id: string; code: string; name: string; kind: string } | null
}

const tab = ref<Tab>('current')
const loading = ref(false)
const deletingId = ref('')
const mutatingId = ref('')
const deleteChoiceOpen = ref(false)
const deleteTarget = ref<OfferRow | null>(null)
const error = ref('')
const setPromoOpen = ref(false)
const setPromoSaving = ref(false)
const setPromoProductId = ref('')
const rows = ref<OfferRow[]>([])
const selectedProductId = ref('')
const productList = ref<Array<{
  id: string
  code: string
  name: string
  kind: string
  amount: number
  quantity: string
  bindings: number
  active: boolean
  bindingAssets: Array<{
    assetId: string
    assetCode: string
    assetName: string
    assetStatus: string
    branchId: string | null
    branchCode: string | null
    branchName: string | null
  }>
}>>([])
const options = ref<{ tenants: Array<{ id: string; code: string; name: string }>; merchants: Array<{ id: string; code: string; name: string }>; branches: Array<{ id: string; code: string; name: string; merchantAccountId?: string }>; types: string[] }>({ tenants: [], merchants: [], branches: [], types: [] })
const { data: authData } = useAuth()

const merchantAccountId = ref('')
const branchId = ref('')
const type = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'
const roleKey = computed(() => String(authData.value?.user?.role || '').toUpperCase())
const isScopedRole = computed(() => roleKey.value === 'MANAGER' || roleKey.value === 'STAFF')
const filterBranches = computed(() => options.value.branches.filter(b => !merchantAccountId.value || b.merchantAccountId === merchantAccountId.value))
function fmtDateTime(v?: string | null) { return v ? new Date(v).toLocaleString() : '-' }
function fmtDate(v?: string | null) { return v ? new Date(v).toLocaleDateString() : '-' }
function fmtTime(v?: string | null) { return v ? new Date(v).toLocaleTimeString() : '-' }
function eventAt(item: OfferRow) { return item.updatedAt || item.effectiveFrom }
function statusTextClass(status?: string | null) {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'VERIFIED' || s === 'BOUND' || s === 'IN_USE') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'SUSPENDED' || s === 'MAINTENANCE' || s === 'SPARE') return 'text-amber-600 dark:text-amber-400'
  if (s === 'DISABLED' || s === 'INACTIVE' || s === 'OFFLINE') return 'text-rose-600 dark:text-rose-400'
  return 'text-slate-700 dark:text-slate-200'
}
function isCurrentPromotion(item?: OfferRow | null) {
  if (!item?.active) return false
  const now = new Date()
  const from = new Date(item.effectiveFrom)
  const to = item.effectiveTo ? new Date(item.effectiveTo) : null
  return from <= now && (!to || to >= now)
}
function isUpcomingPromotion(item?: OfferRow | null) {
  if (!item?.active) return false
  return new Date(item.effectiveFrom) > new Date()
}
const productRows = computed(() => productList.value)
const filteredRows = computed(() => {
  if (!selectedProductId.value) return rows.value
  return rows.value.filter(item => item.product?.id === selectedProductId.value)
})
const productActionOfferMap = computed(() => {
  const out = new Map<string, OfferRow>()
  for (const item of rows.value) {
    const productId = item.product?.id
    if (!productId) continue
    const existing = out.get(productId)
    if (!existing) {
      out.set(productId, item)
      continue
    }
    if (item.active && !existing.active) out.set(productId, item)
  }
  return out
})
const setPromoProduct = computed(() => productRows.value.find(p => p.id === setPromoProductId.value) || null)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{
      items: OfferRow[]
      total: number
      page: number
      pageSize: number
      productList: Array<{
        id: string
        code: string
        name: string
        kind: string
        amount: number
        quantity: string
        bindings: number
        active: boolean
        bindingAssets: Array<{
          assetId: string
          assetCode: string
          assetName: string
          assetStatus: string
          branchId: string | null
          branchCode: string | null
          branchName: string | null
        }>
      }>
      options: typeof options.value
    }>('/api/app/promotions', {
      query: { tab: tab.value, merchantAccountId: merchantAccountId.value || undefined, branchId: branchId.value || undefined, type: type.value || undefined, page: page.value, pageSize: pageSize.value }
    })
    rows.value = res.items || []
    total.value = Number(res.total || 0)
    productList.value = res.productList || []
    if (selectedProductId.value && !rows.value.some(item => item.product?.id === selectedProductId.value)) {
      selectedProductId.value = ''
    }
    options.value = res.options || { tenants: [], merchants: [], branches: [], types: [] }
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (e as Error).message || 'Failed to load promotions'
    rows.value = []
  } finally {
    loading.value = false
  }
}

function openDeleteChoice(item: OfferRow) {
  deleteTarget.value = item
  deleteChoiceOpen.value = true
}

async function deleteUpcoming(id: string, scope: 'asset' | 'branch' = 'asset') {
  deletingId.value = id
  try {
    await $fetch(`/api/app/promotions/${id}`, { method: 'DELETE', query: { scope } })
    deleteChoiceOpen.value = false
    deleteTarget.value = null
    await loadData()
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (e as Error).message || 'Failed to delete promotion'
  } finally {
    deletingId.value = ''
  }
}

async function pausePromotion(id: string, scope: 'asset' | 'branch' = 'asset') {
  mutatingId.value = id
  try {
    await $fetch(`/api/app/promotions/${id}/pause`, { method: 'POST', query: { scope } })
    const target = rows.value.find(item => item.id === id)
    if (target) {
      target.active = false
      target.reason = scope === 'branch' ? 'paused-by-portal-branch' : 'paused-by-portal'
      target.updatedAt = new Date().toISOString()
    }
    if (scope === 'branch') await loadData()
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (e as Error).message || 'Failed to pause promotion'
  } finally {
    mutatingId.value = ''
  }
}

async function resumePromotion(id: string, scope: 'asset' | 'branch' = 'asset') {
  mutatingId.value = id
  try {
    await $fetch(`/api/app/promotions/${id}/resume`, { method: 'POST', query: { scope } })
    const target = rows.value.find(item => item.id === id)
    if (target) {
      target.active = true
      target.reason = scope === 'branch' ? 'resumed-by-portal-branch' : 'resumed-by-portal'
      target.updatedAt = new Date().toISOString()
    }
    if (scope === 'branch') await loadData()
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (e as Error).message || 'Failed to resume promotion'
  } finally {
    mutatingId.value = ''
  }
}

function openSetPromotion(productId: string) {
  setPromoProductId.value = productId
  setPromoOpen.value = true
}

function productActionOffer(productId: string) {
  return productActionOfferMap.value.get(productId) || null
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
  setPromoSaving.value = true
  error.value = ''
  try {
    await $fetch('/api/app/promotions', {
      method: 'POST',
      body: {
        productId: payload.productId,
        branchId: payload.branchId,
        amount: Number(payload.amount),
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo,
        priority: payload.priority,
        replaceActive: payload.replaceActive,
        reason: 'branch-promotion'
      }
    })
    setPromoOpen.value = false
    setPromoSaving.value = false
    tab.value = 'upcoming'
    await loadData()
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string }; message?: string })?.data?.statusMessage || (e as Error).message || 'Failed to set promotion'
  } finally {
    setPromoSaving.value = false
  }
}

watch([tab, merchantAccountId, branchId, type], () => {
  page.value = 1
})
watch([tab, merchantAccountId, branchId, type, page], () => { void loadData() }, { immediate: true })
watch(merchantAccountId, () => {
  branchId.value = ''
  if (isScopedRole.value && !branchId.value && filterBranches.value.length) {
    branchId.value = filterBranches.value[0].id
  }
})
watch(() => options.value.merchants, (rows) => {
  if (merchantAccountId.value && !rows.some(item => item.id === merchantAccountId.value)) {
    merchantAccountId.value = ''
  }
  if (isScopedRole.value && !merchantAccountId.value && rows.length) {
    merchantAccountId.value = rows[0].id
  }
}, { immediate: true })
watch(() => options.value.branches, (rows) => {
  if (branchId.value && !rows.some(item => item.id === branchId.value)) {
    branchId.value = ''
  }
  if (isScopedRole.value && merchantAccountId.value && !branchId.value) {
    const scoped = rows.filter(item => item.merchantAccountId === merchantAccountId.value)
    if (scoped.length) branchId.value = scoped[0].id
  }
}, { immediate: true })
</script>

<template>
  <section class="space-y-4">
    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="grid gap-3 md:grid-cols-3 md:items-end">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-600 dark:text-slate-300">Merchant</label>
            <select v-model="merchantAccountId" :class="selectClass" :disabled="isScopedRole && options.merchants.length <= 1">
              <option v-if="!isScopedRole" value="">All merchants</option>
              <option v-for="m in options.merchants" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-600 dark:text-slate-300">Branch</label>
            <select v-model="branchId" :class="selectClass" :disabled="isScopedRole && filterBranches.length <= 1">
              <option v-if="!isScopedRole" value="">All branches</option>
              <option v-for="b in filterBranches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-600 dark:text-slate-300">Type</label>
            <select v-model="type" :class="selectClass">
              <option value="">All types</option>
              <option v-for="k in options.types" :key="k" :value="k">{{ k }}</option>
            </select>
          </div>
        </div>
      </template>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Product List</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Tenant:
              <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ options.tenants[0]?.name || '-' }}</span>
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Merchant:
              <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ merchantAccountId ? options.merchants.find(m => m.id === merchantAccountId)?.name || '-' : (isScopedRole ? '-' : 'All') }}</span>
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Branch:
              <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ branchId ? options.branches.find(b => b.id === branchId)?.name || '-' : (isScopedRole ? '-' : 'All') }}</span>
            </p>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ productRows.length }} items</p>
        </div>
      </template>
      <div class="rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr>
              <th class="px-3 py-1.5 text-left">Name</th>
              <th class="px-3 py-1.5 text-left">Type</th>
              <th class="px-3 py-1.5 text-center">Price / Promotion</th>
              <th class="px-3 py-1.5 text-center">Service</th>
              <th class="px-3 py-1.5 text-center">Bindings</th>
              <th class="px-3 py-1.5 text-center">Status</th>
              <th class="px-3 py-1.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!productRows.length"><td colspan="7" class="px-3 py-3 text-center text-sm text-slate-500">No products.</td></tr>
            <tr v-for="p in productRows" :key="p.id" class="cursor-pointer border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/60" :class="selectedProductId === p.id ? 'bg-slate-100/70 dark:bg-slate-800/80' : ''" @click="selectedProductId = p.id">
              <td class="px-3 py-1.5">
                <p class="font-medium text-slate-800 dark:text-slate-100">{{ p.name }}</p>
                <p class="text-sm text-slate-500 dark:text-slate-400">{{ p.code }}</p>
              </td>
              <td class="px-3 py-1.5">{{ p.kind }}</td>
              <td class="px-3 py-1.5 text-center">
                <div class="inline-flex items-center justify-center gap-1">
                  <template v-if="isCurrentPromotion(productActionOffer(p.id)) && productActionOffer(p.id)?.amount !== undefined">
                    <span class="text-slate-500 line-through dark:text-slate-400">{{ p.amount }}</span>
                    <span class="text-slate-600 dark:text-slate-300">-></span>
                    <span class="font-semibold text-emerald-600 dark:text-emerald-400">{{ productActionOffer(p.id)?.amount }}</span>
                  </template>
                  <template v-else-if="isUpcomingPromotion(productActionOffer(p.id))">
                    <span>{{ p.amount }}</span>
                    <UIcon name="i-lucide-clock-3" class="h-4 w-4 text-sky-500 dark:text-sky-300" />
                  </template>
                  <span v-else>{{ p.amount }}</span>
                </div>
              </td>
              <td class="px-3 py-1.5 text-center">{{ p.quantity }}</td>
              <td class="px-3 py-1.5 text-center">
                <UPopover v-if="p.bindings > 0" mode="hover">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                    @click.stop
                  >
                    {{ p.bindings }}
                    <UIcon name="i-lucide-chevron-down" class="h-4 w-4" />
                  </UButton>
                  <template #content>
                    <div class="w-[340px] rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                      <p class="px-2 py-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Bound Assets</p>
                      <div class="max-h-56 space-y-1 overflow-auto px-1 pb-1">
                        <div
                          v-for="asset in p.bindingAssets"
                          :key="asset.assetId"
                          class="rounded-md border border-slate-200 px-2 py-1.5 dark:border-slate-700"
                        >
                          <div class="flex items-center justify-between gap-2">
                            <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ asset.assetName }}</p>
                            <p class="text-sm text-slate-500 dark:text-slate-400">{{ asset.branchName || '-' }}</p>
                          </div>
                          <div class="flex items-center justify-between gap-2">
                            <p class="text-sm text-slate-500 dark:text-slate-400">{{ asset.assetCode }}</p>
                            <span class="text-sm font-semibold" :class="statusTextClass(asset.assetStatus)">{{ asset.assetStatus || 'ACTIVE' }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </UPopover>
                <span v-else>0</span>
              </td>
              <td class="px-3 py-1.5 text-center">
                <UBadge :color="p.active ? 'success' : 'error'" variant="soft" size="sm">{{ p.active ? 'ACTIVE' : 'DISABLED' }}</UBadge>
              </td>
              <td class="px-3 py-1.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <UButton
                    v-if="!productActionOffer(p.id)?.id"
                    icon="i-lucide-percent"
                    color="warning"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    title="Set Promotion"
                    @click.stop="openSetPromotion(p.id)"
                  />
                  <UButton
                    v-if="tab !== 'history' && productActionOffer(p.id)?.active"
                    icon="i-lucide-pause"
                    color="warning"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    :title="tab === 'current' ? 'Pause Current Promotion' : 'Pause Upcoming Promotion'"
                    :loading="mutatingId === productActionOffer(p.id)?.id"
                    @click.stop="productActionOffer(p.id)?.id && pausePromotion(productActionOffer(p.id)!.id, 'branch')"
                  />
                  <UButton
                    v-else-if="tab !== 'history' && productActionOffer(p.id)?.id"
                    icon="i-lucide-play"
                    color="success"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    title="Resume Paused Promotion"
                    :loading="mutatingId === productActionOffer(p.id)?.id"
                    @click.stop="productActionOffer(p.id)?.id && resumePromotion(productActionOffer(p.id)!.id, 'branch')"
                  />
                  <UButton
                    v-if="tab !== 'history' && productActionOffer(p.id)?.active"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    :loading="deletingId === productActionOffer(p.id)?.id"
                    @click.stop="productActionOffer(p.id) && openDeleteChoice(productActionOffer(p.id)!)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Promotion</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Tenant:
            <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ options.tenants[0]?.name || '-' }}</span>
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Merchant:
            <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ merchantAccountId ? options.merchants.find(m => m.id === merchantAccountId)?.name || '-' : 'All' }}</span>
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Branch:
            <span class="ml-1 font-semibold text-slate-800 dark:text-slate-100">{{ branchId ? options.branches.find(b => b.id === branchId)?.name || '-' : 'All' }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
        <UButton size="sm" :variant="tab === 'current' ? 'solid' : 'soft'" color="neutral" @click="tab = 'current'">Current</UButton>
        <UButton size="sm" :variant="tab === 'upcoming' ? 'solid' : 'soft'" color="neutral" @click="tab = 'upcoming'">Upcoming</UButton>
        <UButton size="sm" :variant="tab === 'history' ? 'solid' : 'soft'" color="neutral" @click="tab = 'history'">History</UButton>
      </div>
      </div>
      <UAlert v-if="error" class="mt-3" color="error" variant="soft" :title="error" />
      <div class="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr>
              <th class="px-3 py-2 text-left">Asset Name / Code</th>
              <th class="px-3 py-2 text-left">Product</th>
              <th class="px-3 py-2 text-left">Type</th>
              <th class="px-3 py-2 text-left">Price</th>
              <th class="px-3 py-2 text-left">Start</th>
              <th class="px-3 py-2 text-left">End</th>
              <th class="px-3 py-2 text-left">Priority</th>
              <th class="px-3 py-2 text-left">Event At</th>
              <th class="px-3 py-2 text-left">Reason</th>
              <th class="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="10" class="px-3 py-4 text-center text-sm text-slate-500">Loading...</td></tr>
            <tr v-else-if="!filteredRows.length"><td colspan="10" class="px-3 py-4 text-center text-sm text-slate-500">No promotions.</td></tr>
            <tr v-for="item in filteredRows" :key="item.id" class="border-t border-slate-200 dark:border-slate-700">
              <td class="px-3 py-2">
                <p class="font-medium text-slate-800 dark:text-slate-100">{{ item.asset?.name || '-' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ item.asset?.code || '-' }}</p>
              </td>
              <td class="px-3 py-2">{{ item.product?.name || '-' }}</td>
              <td class="px-3 py-2">{{ item.product?.kind || '-' }}</td>
              <td class="px-3 py-2">{{ item.amount }}</td>
              <td class="px-3 py-2">
                <p class="text-sm text-slate-700 dark:text-slate-200">{{ fmtDate(item.effectiveFrom) }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ fmtTime(item.effectiveFrom) }}</p>
              </td>
              <td class="px-3 py-2">
                <p class="text-sm text-slate-700 dark:text-slate-200">{{ item.effectiveTo ? fmtDate(item.effectiveTo) : '-' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ item.effectiveTo ? fmtTime(item.effectiveTo) : '-' }}</p>
              </td>
              <td class="px-3 py-2">P{{ item.priority }}</td>
              <td class="px-3 py-2">
                <p class="text-sm text-slate-700 dark:text-slate-200">{{ fmtDate(eventAt(item)) }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ fmtTime(eventAt(item)) }}</p>
              </td>
              <td class="px-3 py-2">{{ item.reason || '-' }}</td>
              <td class="px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-1">
                  <UButton
                    v-if="tab !== 'history' && item.active"
                    icon="i-lucide-pause"
                    color="warning"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    :title="tab === 'current' ? 'Pause Current Promotion' : 'Pause Upcoming Promotion'"
                    :loading="mutatingId === item.id"
                    @click="pausePromotion(item.id)"
                  />
                  <UButton
                    v-else-if="tab !== 'history'"
                    icon="i-lucide-play"
                    color="success"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    title="Resume Paused Promotion"
                    :loading="mutatingId === item.id"
                    @click="resumePromotion(item.id)"
                  />
                  <UButton
                    v-if="tab !== 'history' && item.active"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8"
                    :loading="deletingId === item.id"
                    @click="openDeleteChoice(item)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-3 flex items-center justify-end gap-2">
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ total }} items</p>
        <UButton size="sm" color="neutral" variant="soft" :disabled="page <= 1 || loading" @click="page = Math.max(1, page - 1)">Prev</UButton>
        <p class="text-sm text-slate-600 dark:text-slate-300">Page {{ page }} / {{ totalPages }}</p>
        <UButton size="sm" color="neutral" variant="soft" :disabled="page >= totalPages || loading" @click="page = Math.min(totalPages, page + 1)">Next</UButton>
      </div>
    </UCard>

    <PromotionSetPromotionModal
      v-model:open="setPromoOpen"
      :saving="setPromoSaving"
      :product="setPromoProduct"
      :tenants="options.tenants"
      :merchants="options.merchants"
      :branches="options.branches"
      :default-merchant-id="merchantAccountId"
      :default-branch-id="branchId"
      @submit="submitSetPromotion"
      @error="error = $event"
    />

    <UModal v-model:open="deleteChoiceOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Delete Promotion</h3>
          </template>
          <div class="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <p>Choose delete scope for this promotion.</p>
            <p class="font-medium">Asset: {{ deleteTarget?.asset?.name || '-' }} ({{ deleteTarget?.asset?.code || '-' }})</p>
            <p class="font-medium">Branch: {{ deleteTarget?.asset?.branch?.name || '-' }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="deleteChoiceOpen = false">Cancel</UButton>
              <UButton color="warning" variant="soft" :loading="deletingId === deleteTarget?.id" @click="deleteTarget && deleteUpcoming(deleteTarget.id, 'asset')">Delete This Asset Only</UButton>
              <UButton color="error" :loading="deletingId === deleteTarget?.id" @click="deleteTarget && deleteUpcoming(deleteTarget.id, 'branch')">Delete All Assets In Branch</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
