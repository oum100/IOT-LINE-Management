<script setup lang="ts">
type StaticQrData = {
  mode: string
  qrText: string
  amount: number
  asset: { id: string; code: string; name: string }
  branch: { id: string | null; code: string | null; name: string | null }
  merchant: { id: string | null; code: string | null; name: string | null }
  product: { id: string; code: string; name: string; baseAmount: number }
  currentOffer: { id: string; pricingType: string; amount: number; priority: number; effectiveFrom: string; effectiveTo?: string | null } | null
  biller: {
    source: string
    providerCode: string | null
    integrationMode: string
    qrPaymentMode: string | null
    billerId: string | null
    shopId: string | null
    accountName: string | null
    bankName: string | null
    accountNumber: string | null
    promptPayTarget: string | null
  } | null
  qrFields: {
    reference: string
    tenantId: string
    branchCode: string | null
    assetCode: string
    productCode: string
  }
}

const props = defineProps<{
  open: boolean
  loading: boolean
  error: string
  data: StaticQrData | null
  copyDone: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'copy'): void
}>()

const staticQrImageUrl = computed(() => {
  const text = props.data?.qrText || ''
  if (!text) return ''
  return `/api/app/qr-image?text=${encodeURIComponent(text)}`
})

const staticQrDownloadUrl = computed(() => {
  const text = props.data?.qrText || ''
  if (!text) return ''
  return `/api/app/qr-image?text=${encodeURIComponent(text)}`
})

function close() {
  emit('update:open', false)
}
</script>

<template>
  <UModal :open="open" :ui="{ content: 'sm:max-w-3xl' }" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Static ThaiQR</h3>
              <div v-if="data" class="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <p class="text-slate-600 dark:text-slate-300">
                  Asset:
                  <span class="font-semibold text-slate-900 dark:text-slate-100">{{ data.asset.name }}</span>
                  <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">{{ data.asset.code }}</span>
                </p>
                <p class="text-slate-600 dark:text-slate-300">
                  Product:
                  <span class="font-semibold text-slate-900 dark:text-slate-100">{{ data.product.name }}</span>
                  <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">{{ data.product.code }}</span>
                </p>
              </div>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="close" />
          </div>
        </template>
        <div class="space-y-3">
          <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />
          <div v-if="loading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Building QR...</div>
          <div v-else-if="data" class="grid gap-3 md:grid-cols-[280px_1fr]">
            <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <img :src="staticQrImageUrl" alt="Static ThaiQR" class="mx-auto h-60 w-60 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700">
              <div class="mt-2 flex items-center justify-center gap-2">
                <a :href="staticQrDownloadUrl" download="thaiqr-static.png" class="inline-flex h-10 items-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">Download QR</a>
              </div>
            </div>
            <div class="space-y-2">
              <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Biller Info</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Source: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.biller?.source || '-' }}</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Provider: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.biller?.providerCode || '-' }}</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Mode: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.mode }}</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">PromptPay Target: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.biller?.promptPayTarget || '-' }}</span></p>
              </div>
              <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">QR Fields</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Tenant: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.qrFields.tenantId }}</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Merchant: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.merchant.code || '-' }} {{ data.merchant.name || '' }}</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Branch: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.branch.code || '-' }} {{ data.branch.name || '' }}</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Asset: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.asset.code }}</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Product: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.product.code }}</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Amount: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.amount }} THB</span></p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Reference: <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.qrFields.reference }}</span></p>
              </div>
              <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">QR Text</p>
                  <UButton size="xs" color="primary" variant="solid" icon="i-lucide-copy" class="text-white dark:text-white" @click="emit('copy')">{{ copyDone ? 'Copied' : 'Copy' }}</UButton>
                </div>
                <p class="max-h-40 overflow-auto break-all rounded-md bg-slate-50 p-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{{ data.qrText }}</p>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
