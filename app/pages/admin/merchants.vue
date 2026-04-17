<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute } from "vue-router"

definePageMeta({
  middleware: "portal-auth",
})

type MerchantStatus = "ACTIVE" | "SUSPENDED" | "DISABLED"
type MerchantEnvironment = "TEST" | "LIVE"

type MerchantRecord = {
  id: string
  tenantId: string
  code: string
  name: string
  status: MerchantStatus
  environment: MerchantEnvironment
  createdAt: string
  updatedAt: string
}

type PagingResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const route = useRoute()

const loading = ref(false)
const error = ref("")
const query = ref("")
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const merchants = ref<MerchantRecord[]>([])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasPrevPage = computed(() => page.value > 1)
const hasNextPage = computed(() => page.value < totalPages.value)

function readTenantId(): string {
  const raw = route.query.tenantId
  return typeof raw === "string" ? raw.trim() : ""
}

function merchantStatusClass(status: MerchantStatus) {
  if (status === "ACTIVE") return "text-emerald-600 dark:text-emerald-400"
  if (status === "SUSPENDED") return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function setError(err: unknown) {
  error.value = err instanceof Error ? err.message : "Request failed"
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

async function loadMerchants(resetPage = false) {
  if (resetPage) page.value = 1

  loading.value = true
  error.value = ""
  try {
    const tenantId = readTenantId()
    const response = await $fetch<PagingResponse<MerchantRecord>>("/api/admin/merchants", {
      query: {
        ...(tenantId ? { tenantId } : {}),
        ...(query.value ? { q: query.value } : {}),
        page: page.value,
        pageSize: pageSize.value,
      },
    })

    merchants.value = response.items || []
    total.value = Number(response.total || 0)
    page.value = Number(response.page || page.value)
    pageSize.value = Number(response.pageSize || pageSize.value)
  } catch (err) {
    merchants.value = []
    total.value = 0
    setError(err)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  void loadMerchants()
}

function refreshMerchants() {
  void loadMerchants()
}

function goToPage(target: number) {
  const next = Math.min(Math.max(1, target), totalPages.value)
  if (next === page.value) return
  page.value = next
  void loadMerchants()
}

onMounted(() => {
  void loadMerchants(true)
})
</script>

<template>
  <section class="space-y-4 text-slate-900 dark:text-slate-100">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Merchant Management</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage merchant accounts
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          icon="i-lucide-refresh-cw"
          class="text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60"
          :loading="loading"
          @click="refreshMerchants"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-alert-triangle" :title="error" />

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Merchant List</h2>
          <div class="flex items-center gap-2">
            <UInput
              v-model="query"
              placeholder="Search merchant..."
              class="w-[300px] bg-white dark:bg-slate-950"
              :ui="{
                base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600',
              }"
            />
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-search"
              class="text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              :loading="loading"
              @click="onSearch"
            >
              Search
            </UButton>
          </div>
        </div>
      </template>

      <div v-if="loading && !merchants.length" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading merchants...
      </div>

      <div v-else class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table class="w-full min-w-[900px] text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr class="text-left">
              <th class="px-3 py-2">Code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Environment</th>
              <th class="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="merchant in merchants"
              :key="merchant.id"
              class="border-t border-slate-200 transition-colors duration-150 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
            >
              <td class="px-3 py-2">
                <span class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {{ merchant.code }}
                </span>
              </td>
              <td class="px-3 py-2">{{ merchant.name }}</td>
              <td class="px-3 py-2">
                <span class="text-xs font-semibold" :class="merchantStatusClass(merchant.status)">
                  {{ merchant.status }}
                </span>
              </td>
              <td class="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{{ merchant.environment }}</td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{{ formatDate(merchant.updatedAt) }}</td>
            </tr>
            <tr v-if="!merchants.length">
              <td colspan="5" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No merchants found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Showing {{ merchants.length }} of {{ total }} merchants
        </p>
        <div class="flex items-center gap-2">
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevrons-left" :disabled="!hasPrevPage || loading" @click="goToPage(1)" />
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevron-left" :disabled="!hasPrevPage || loading" @click="goToPage(page - 1)" />
          <span class="px-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Page {{ page }} / {{ totalPages }}</span>
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevron-right" :disabled="!hasNextPage || loading" @click="goToPage(page + 1)" />
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-chevrons-right" :disabled="!hasNextPage || loading" @click="goToPage(totalPages)" />
        </div>
      </div>
    </UCard>
  </section>
</template>
