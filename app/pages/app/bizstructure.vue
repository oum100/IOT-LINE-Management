<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Position } from '@vue-flow/core'
import OrgNode from '~/components/flow/OrgNode.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})

type TenantDetailResponse = {
  selectedMerchantId: string
  selectedBranchId: string
  merchants: Array<{ id: string; code: string; name: string }>
  branches: Array<{ id: string; code: string; name: string; merchantAccountId: string | null; orderCount: number }>
  assets: Array<{ id: string; branchId: string }>
  devices: Array<{ id: string }>
  machines: Array<{ id: string }>
  products: Array<{ id: string }>
}
type GovernanceResponse = {
  users: Array<{
    id: string
    role: 'OWNER' | 'MANAGER' | 'STAFF'
    merchantAccountId: string | null
    isActive: boolean
    scopeAssignments: Array<{
      scopeType: 'MERCHANT' | 'BRANCH'
      merchantAccountId: string | null
      branchId: string | null
    }>
  }>
}

const merchantId = ref('')
const branchId = ref('')
const { data: authData } = useAuth()
const roleKey = computed(() => String(authData.value?.user?.role || '').toUpperCase())
const isScopedRole = computed(() => roleKey.value === 'MANAGER' || roleKey.value === 'STAFF')

const { data, pending, error } = await useFetch<TenantDetailResponse>('/api/app/tenant', {
  query: computed(() => ({
    merchantId: merchantId.value || undefined,
    branchId: branchId.value || undefined
  }))
})
const { data: governanceData } = await useFetch<GovernanceResponse>('/api/app/governance')

const merchants = computed(() => data.value?.merchants || [])
const branches = computed(() => data.value?.branches || [])
const branchOptions = computed(() => {
  if (!merchantId.value) return branches.value
  return branches.value.filter(b => b.merchantAccountId === merchantId.value)
})

watch(data, (val) => {
  if (!val) return
  if (!merchantId.value) merchantId.value = val.selectedMerchantId || val.merchants[0]?.id || ''
  if (!branchId.value) branchId.value = val.selectedBranchId || val.branches[0]?.id || ''
}, { immediate: true })

watch(merchantId, () => {
  if (branchId.value && !branchOptions.value.some(b => b.id === branchId.value)) branchId.value = ''
  if (!branchId.value && branchOptions.value.length) branchId.value = branchOptions.value[0].id
})

watch(merchants, (rows) => {
  if (merchantId.value && !rows.some(item => item.id === merchantId.value)) merchantId.value = ''
  if (isScopedRole.value && !merchantId.value && rows.length) merchantId.value = rows[0].id
})

watch(branchOptions, (rows) => {
  if (branchId.value && !rows.some(item => item.id === branchId.value)) branchId.value = ''
  if (isScopedRole.value && !branchId.value && rows.length) branchId.value = rows[0].id
})

const selectedMerchant = computed(() => merchants.value.find(m => m.id === merchantId.value))
const selectedBranch = computed(() => branches.value.find(b => b.id === branchId.value))

const scopedAssets = computed(() => {
  const rows = data.value?.assets || []
  if (!branchId.value) return rows
  return rows.filter(a => a.branchId === branchId.value)
})

const orderCount = computed(() => selectedBranch.value?.orderCount || 0)
const scopedUsers = computed(() => {
  const rows = governanceData.value?.users || []
  return rows.filter((u) => {
    if (branchId.value) {
      const hasBranchScope = u.scopeAssignments.some(s => s.scopeType === 'BRANCH' && s.branchId === branchId.value)
      if (hasBranchScope) return true
    }

    if (merchantId.value) {
      if (u.merchantAccountId === merchantId.value) return true
      const hasMerchantScope = u.scopeAssignments.some(s => s.scopeType === 'MERCHANT' && s.merchantAccountId === merchantId.value)
      if (hasMerchantScope) return true
    }

    if (!merchantId.value && !branchId.value) return true
    return false
  })
})
const userCount = computed(() => {
  return scopedUsers.value.length
})

const businessNodes = computed(() => [
  { id: 'b-merchant', type: 'org', position: { x: 320, y: 30 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: `Merchant\n${selectedMerchant.value?.name || '-'}` } },
  { id: 'b-branch', type: 'org', position: { x: 160, y: 220 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: `Branch\n${selectedBranch.value?.name || '-'}` } },
  { id: 'b-user', type: 'org', position: { x: 480, y: 220 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: `User\n${userCount.value}` } }
])

const businessEdges = computed(() => [
  { id: 'be-m-b', source: 'b-merchant', target: 'b-branch', type: 'smoothstep', sourcePosition: Position.Bottom, targetPosition: Position.Top, style: { stroke: '#3b82f6' } },
  { id: 'be-m-u', source: 'b-merchant', target: 'b-user', type: 'smoothstep', sourcePosition: Position.Bottom, targetPosition: Position.Top, style: { stroke: '#3b82f6' } }
])

const operationNodes = computed(() => [
  { id: 'o-asset', type: 'org', position: { x: 160, y: 180 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: `Asset\n${scopedAssets.value.length}` } },
  { id: 'o-products', type: 'org', position: { x: 450, y: 180 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: `Products\n${data.value?.products.length || 0}` } },
  { id: 'o-order', type: 'org', position: { x: 305, y: 20 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: `Order\n${orderCount.value}` } },
  { id: 'o-promotion', type: 'org', position: { x: 466, y: 320 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: 'Promotion', compact: true } },
  { id: 'o-device', type: 'org', position: { x: 90, y: 320 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: `Device\n${data.value?.devices.length || 0}`, compact: true } },
  { id: 'o-machine', type: 'org', position: { x: 262, y: 320 }, sourcePosition: Position.Bottom, targetPosition: Position.Top, data: { label: `Machine\n${data.value?.machines.length || 0}`, compact: true } }
])

const operationEdges = computed(() => [
  { id: 'oe-o-a', source: 'o-order', target: 'o-asset', type: 'smoothstep', sourcePosition: Position.Bottom, targetPosition: Position.Top, style: { stroke: '#3b82f6' } },
  { id: 'oe-o-p', source: 'o-order', target: 'o-products', type: 'smoothstep', sourcePosition: Position.Bottom, targetPosition: Position.Top, style: { stroke: '#3b82f6' } },
  { id: 'oe-p-pr', source: 'o-products', target: 'o-promotion', type: 'default', sourcePosition: Position.Bottom, targetPosition: Position.Top, style: { stroke: '#10b981', strokeDasharray: '2 4' } },
  { id: 'oe-a-d', source: 'o-asset', target: 'o-device', targetHandle: 't-top', sourceHandle: 's-bottom', type: 'smoothstep', sourcePosition: Position.Bottom, targetPosition: Position.Top, style: { stroke: '#f59e0b', strokeDasharray: '6 4' } },
  { id: 'oe-a-m', source: 'o-asset', target: 'o-machine', targetHandle: 't-top', sourceHandle: 's-bottom', type: 'smoothstep', sourcePosition: Position.Bottom, targetPosition: Position.Top, style: { stroke: '#f59e0b', strokeDasharray: '6 4' } }
])

const selectClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'
const nodeTypes = { org: OrgNode }
</script>

<template>
  <section class="space-y-4">
    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Business</p>
          <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Business Structure</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Overview graph of Merchant -> Branch -> Operation nodes.</p>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/app/tenant" color="primary" class="text-white">Open Structure Workspace</UButton>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Merchant</span>
          <select v-model="merchantId" :class="selectClass" :disabled="isScopedRole && merchants.length <= 1">
            <option v-if="!isScopedRole" value="">All merchants</option>
            <option v-for="m in merchants" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Branch</span>
          <select v-model="branchId" :class="selectClass" :disabled="isScopedRole && branchOptions.length <= 1">
            <option v-if="!isScopedRole" value="">All branches</option>
            <option v-for="b in branchOptions" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </label>
      </div>
      <UAlert v-if="error" class="mt-3" color="error" variant="soft" title="Failed to load business overview." />
      <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <div class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">Business Flow</div>
          <div class="h-[380px]">
            <VueFlow
              :nodes="businessNodes"
              :edges="businessEdges"
              :node-types="nodeTypes"
              fit-view-on-init
              :min-zoom="0.6"
              :max-zoom="1.2"
              class="biz-flow h-full w-full bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
        <div class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <div class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">Operation Flow</div>
          <div class="h-[380px]">
            <div v-if="pending" class="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-300">Loading overview...</div>
            <VueFlow
              v-else
              :nodes="operationNodes"
              :edges="operationEdges"
              :node-types="nodeTypes"
              fit-view-on-init
              :min-zoom="0.6"
              :max-zoom="1.2"
              class="biz-flow h-full w-full bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
        <div class="inline-flex items-center gap-2">
          <span class="h-0.5 w-7 rounded bg-blue-500" />
          <span>Solid line: <span class="font-semibold text-slate-800 dark:text-slate-100">owns</span> (primary parent)</span>
        </div>
        <div class="inline-flex items-center gap-2">
          <span class="h-0.5 w-7 border-t-2 border-dashed border-amber-500" />
          <span>Dashed amber: <span class="font-semibold text-slate-800 dark:text-slate-100">binds</span> (secondary relation)</span>
        </div>
        <div class="inline-flex items-center gap-2">
          <span class="h-0.5 w-7 border-t-2 border-dotted border-emerald-500" />
          <span>Dotted green: <span class="font-semibold text-slate-800 dark:text-slate-100">dimension</span> (reporting join)</span>
        </div>
      </div>
    </UCard>
  </section>
</template>

<style scoped>
:deep(.biz-flow .vue-flow__edge-path) {
  stroke-width: 1.75;
}

:deep(.biz-flow .vue-flow__edge-text) {
  fill: rgb(71 85 105);
  font-size: 12px;
  font-weight: 700;
}

:deep(.dark .biz-flow .vue-flow__edge-text) {
  fill: rgb(203 213 225);
}
</style>
