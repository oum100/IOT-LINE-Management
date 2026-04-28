<script setup lang="ts">
const colorMode = useColorMode()
const { locale, toggleLocale, t } = useAppLocale()

const items = computed(() => [
  { to: '/platform/dashboard', label: t('แดชบอร์ด', 'Dashboard') },
  { to: '/admin/tenant', label: t('common.tenants', 'Tenants') },
  { to: '/admin/merchants', label: t('common.merchants', 'Merchants') },
  { to: '/admin/branches', label: t('common.branches', 'Branches') },
  { to: '/admin/assets', label: t('common.assets', 'Assets') },
  { to: '/admin/devices', label: t('common.devices', 'Devices') },
  { to: '/admin/machine', label: t('common.machines', 'Machines') },
  { to: '/admin/orders', label: t('common.orders', 'Orders') },
  { to: '/admin/payment', label: t('common.payments', 'Payments') },
  { to: '/admin/settings', label: t('ตั้งค่า', 'Settings') }
])

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="min-h-screen bg-slate-200 dark:bg-slate-800">
    <header class="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">{{ t('พอร์ทัลแพลตฟอร์ม', 'Platform Portal') }}</p>
          <h1 class="text-xl font-semibold text-slate-900 dark:text-white">WashPoint Platform Admin</h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            @click="toggleLocale"
          >
            {{ locale.toUpperCase() }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            @click="toggleTheme"
          >
            {{ colorMode.value === 'dark' ? 'Light' : 'Dark' }}
          </button>
        </div>
      </div>
    </header>
    <div class="grid min-h-[calc(100vh-78px)] grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside class="border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <nav class="space-y-2">
          <NuxtLink
            v-for="item in items"
            :key="item.to + item.label"
            :to="item.to"
            class="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
      </aside>
      <main class="px-4 py-4 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
  </div>
</template>
