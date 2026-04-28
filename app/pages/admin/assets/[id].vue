<script setup lang="ts">
definePageMeta({
  middleware: "portal-auth",
})

type AssetDetails = {
  id: string
  code: string
  name: string
  kind: string
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE"
  assetUuid: string
  metadata?: Record<string, any> | null
  branch?: {
    id: string
    code: string
    name: string
  } | null
  activeBinding?: {
    id: string
    iotDevice?: { id: string; macAddress: string; deviceUid?: string | null } | null
    machineUnit?: { id: string; serialNo: string } | null
    startedAt: string
    reason?: string | null
  } | null
  offersTimeline?: {
    current: Array<any>
    upcoming: Array<any>
    history: Array<any>
  }
}

const route = useRoute()
const loading = ref(false)
const error = ref("")
const details = ref<AssetDetails | null>(null)
const activeTab = ref<"iot" | "machine" | "product">("iot")

const id = computed(() => String(route.params.id || "").trim())

function setError(err: unknown) {
  error.value = err instanceof Error ? err.message : "Request failed"
}

async function loadDetails() {
  if (!id.value) return
  loading.value = true
  error.value = ""
  try {
    details.value = await $fetch<AssetDetails>(`/api/admin/assets/${id.value}`)
  } catch (err) {
    details.value = null
    setError(err)
  } finally {
    loading.value = false
  }
}

function backToAssets() {
  const query: Record<string, string> = {}
  const tenantId = typeof route.query.tenantId === "string" ? route.query.tenantId : ""
  const merchantAccountId = typeof route.query.merchantAccountId === "string" ? route.query.merchantAccountId : ""
  const branchId = typeof route.query.branchId === "string" ? route.query.branchId : ""
  if (tenantId) query.tenantId = tenantId
  if (merchantAccountId) query.merchantAccountId = merchantAccountId
  if (branchId) query.branchId = branchId
  void navigateTo({ path: "/admin/assets", query })
}

function formatDate(value?: string) {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

onMounted(() => {
  void loadDetails()
})

watch(id, () => {
  void loadDetails()
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Asset Detail</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">View linked IoT device, machine and product timeline</p>
      </div>
      <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left" @click="backToAssets">
        Back to Assets
      </UButton>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ details?.code || "-" }} {{ details?.name || "" }}
          </h2>
          <UButton color="primary" variant="soft" icon="i-lucide-refresh-cw" :loading="loading" @click="loadDetails">
            Refresh
          </UButton>
        </div>
      </template>

      <div v-if="loading && !details" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading asset detail...
      </div>

      <div v-else-if="details" class="space-y-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Asset UUID</p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ details.assetUuid }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Type</p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ details.kind }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Status</p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ details.status }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Branch</p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ details.branch?.name || "-" }}</p>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 md:col-span-2">
            <div class="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-xs font-semibold transition"
                :class="activeTab === 'iot'
                  ? 'border-blue-400 bg-blue-100 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'"
                @click="activeTab = 'iot'"
              >
                IoT Device
              </button>
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-xs font-semibold transition"
                :class="activeTab === 'machine'
                  ? 'border-blue-400 bg-blue-100 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'"
                @click="activeTab = 'machine'"
              >
                Machine
              </button>
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-xs font-semibold transition"
                :class="activeTab === 'product'
                  ? 'border-blue-400 bg-blue-100 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'"
                @click="activeTab = 'product'"
              >
                Product
              </button>
            </div>

            <div v-if="activeTab === 'iot'" class="space-y-2">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">IoT Device Information</h3>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                Mac Address: {{ details.activeBinding?.iotDevice?.macAddress || "Not bound" }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Device UID: {{ details.activeBinding?.iotDevice?.deviceUid || "-" }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Binding Started: {{ formatDate(details.activeBinding?.startedAt) }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Reason: {{ details.activeBinding?.reason || "-" }}
              </p>
            </div>

            <div v-else-if="activeTab === 'machine'" class="space-y-2">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Machine Information</h3>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                Serial No: {{ details.activeBinding?.machineUnit?.serialNo || "Not bound" }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Binding Started: {{ formatDate(details.activeBinding?.startedAt) }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Reason: {{ details.activeBinding?.reason || "-" }}
              </p>
            </div>

            <div v-else class="space-y-3">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Product Timeline</h3>
              <div class="grid gap-2 md:grid-cols-3">
                <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Current</p>
                  <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ details.offersTimeline?.current?.length || 0 }}</p>
                </div>
                <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">Upcoming</p>
                  <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ details.offersTimeline?.upcoming?.length || 0 }}</p>
                </div>
                <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p class="text-xs font-semibold text-slate-500 dark:text-slate-300">History</p>
                  <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ details.offersTimeline?.history?.length || 0 }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </section>
</template>
