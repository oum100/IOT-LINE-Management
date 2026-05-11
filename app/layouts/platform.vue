<script setup lang="ts">
const colorMode = useColorMode()
const { locale, toggleLocale, t } = useAppLocale()
const { data } = useAuth()
const sidebarOpen = ref(true)
const groupOpen = ref<Record<string, boolean>>({
  'business-structure': true,
  'asset-operations': true,
  'product-pricing': true,
  commerce: true,
  connections: true,
  administration: true
})

const isPlatformAdmin = computed(() => String(data.value?.user?.role || '').toUpperCase() === 'ADMIN')
const items = computed(() => [
  {
    section: 'main',
    items: [
      { to: '/platform/dashboard', label: t('แดชบอร์ด', 'Dashboard'), icon: 'i-lucide-layout-dashboard' },
      { to: '/platform/dashboard2', label: 'Dashboard v2', icon: 'i-lucide-line-chart' }
    ]
  },
  {
    section: 'business-structure',
    title: t('Business Structure', 'Business Structure'),
    icon: 'i-lucide-building-2',
    items: [
      { to: '/admin/business-structure', label: t('Business Structure Mgmt', 'Business Structure Mgmt'), child: true, icon: 'i-lucide-network' },
      { to: '/admin/tenant', label: t('common.tenants', 'Tenants'), child: true, icon: 'i-lucide-building-2' },
      { to: '/admin/merchants', label: t('common.merchants', 'Merchants'), child: true, icon: 'i-lucide-store' },
      { to: '/admin/branches', label: t('common.branches', 'Branches'), child: true, icon: 'i-lucide-map-pinned' }
    ]
  },
  {
    section: 'asset-operations',
    title: t('Asset Operations', 'Asset Operations'),
    icon: 'i-lucide-hard-drive',
    items: [
      { to: '/admin/assets', label: t('common.assets', 'Assets'), child: true, icon: 'i-lucide-package' },
      { to: '/admin/devices', label: t('common.devices', 'Devices'), child: true, icon: 'i-lucide-cpu' },
      { to: '/admin/register-codes', label: 'Register Code', child: true, icon: 'i-lucide-key-round' },
      { to: '/admin/machine', label: t('common.machines', 'Machines'), child: true, icon: 'i-lucide-cog' }
    ]
  },
  {
    section: 'product-pricing',
    title: t('Product & Pricing', 'Product & Pricing'),
    icon: 'i-lucide-tag',
    items: [
      { to: '/admin/promotion', label: t('Promotions', 'Promotions'), child: true, icon: 'i-lucide-badge-percent' },
      { to: '/admin/product', label: t('Products', 'Products'), child: true, icon: 'i-lucide-receipt-text' },
      { to: '/admin/product-types', label: t('Product Types', 'Product Types'), child: true, icon: 'i-lucide-tags' }
    ]
  },
  {
    section: 'commerce',
    title: t('Commerce', 'Commerce'),
    icon: 'i-lucide-shopping-cart',
    items: [
      { to: '/admin/orders', label: t('common.orders', 'Orders'), child: true, icon: 'i-lucide-clipboard-list' },
      { to: '/admin/payment', label: t('common.payments', 'Payments'), child: true, icon: 'i-lucide-credit-card' }
    ]
  },
  {
    section: 'connections',
    title: t('Connections', 'Connections'),
    icon: 'i-lucide-link',
    items: [
      { to: '/admin/billers', label: t('Billers', 'Billers'), child: true, icon: 'i-lucide-wallet' },
      { to: '/admin/provider', label: t('Provider Service', 'Provider Service'), child: true, icon: 'i-lucide-network' },
      { to: '/admin/provider-connections', label: t('Provider Connection', 'Provider Connection'), child: true, icon: 'i-lucide-plug' }
    ]
  },
  {
    section: 'administration',
    title: t('Administration', 'Administration'),
    icon: 'i-lucide-shield-check',
    items: [
      ...(isPlatformAdmin.value ? [{ to: '/admin/users', label: t('ผู้ใช้', 'Users'), child: true, icon: 'i-lucide-users' }] : []),
      { to: '/admin/settings', label: t('ตั้งค่า', 'Settings'), child: true, icon: 'i-lucide-settings' }
    ]
  }
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
            @click="sidebarOpen = !sidebarOpen"
          >
            <UIcon :name="sidebarOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'" class="h-4 w-4" />
          </button>
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
    <div
      class="grid min-h-[calc(100vh-78px)] grid-cols-1 transition-all duration-200"
      :class="sidebarOpen ? 'lg:grid-cols-[280px_1fr]' : 'lg:grid-cols-[88px_1fr]'"
    >
      <aside class="border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div class="space-y-2">
          <NuxtLink
            v-for="item in items[0]?.items || []"
            :key="item.to + item.label"
            :to="item.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <UIcon :name="item.icon" class="h-5 w-5 shrink-0" />
            <span v-if="sidebarOpen">{{ item.label }}</span>
          </NuxtLink>
          <div
            v-for="group in items.slice(1)"
            :key="group.section"
            class="rounded-lg border border-slate-200/80 dark:border-slate-800"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              @click="groupOpen[group.section] = !groupOpen[group.section]"
            >
              <span class="flex items-center gap-3">
                <UIcon :name="group.icon" class="h-5 w-5 shrink-0" />
                <span v-if="sidebarOpen">{{ group.title }}</span>
              </span>
              <UIcon
                v-if="sidebarOpen"
                :name="groupOpen[group.section] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="h-4 w-4"
              />
            </button>
            <div v-if="sidebarOpen && groupOpen[group.section]" class="border-t border-slate-200 px-2 py-1 dark:border-slate-800">
              <NuxtLink
                v-for="item in group.items"
                :key="item.to + item.label"
                :to="item.to"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <UIcon :name="item.icon" class="h-4 w-4 shrink-0" />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </aside>
      <main class="px-4 py-4 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
  </div>
</template>
