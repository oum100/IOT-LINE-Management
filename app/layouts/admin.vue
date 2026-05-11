<script setup lang="ts">
const { t } = useI18n()
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
const sidebarMenus = computed(() => [
  {
    section: 'main',
    items: [
      { to: '/platform/dashboard', label: t('common.dashboard'), icon: 'i-lucide-layout-dashboard' },
      { to: '/platform/dashboard2', label: 'Dashboard v2', icon: 'i-lucide-line-chart' }
    ]
  },
  {
    section: 'business-structure',
    title: 'Business Structure',
    icon: 'i-lucide-building-2',
    items: [
      { to: '/admin/business-structure', label: 'Business Structure Mgmt', child: true, icon: 'i-lucide-network' },
      { to: '/admin/tenant', label: t('common.tenants'), child: true, icon: 'i-lucide-building-2' },
      { to: '/admin/merchants', label: t('common.merchants'), child: true, icon: 'i-lucide-store' },
      { to: '/admin/branchs', label: t('common.branches'), child: true, icon: 'i-lucide-map-pinned' }
    ]
  },
  {
    section: 'asset-operations',
    title: 'Asset Operations',
    icon: 'i-lucide-hard-drive',
    items: [
      { to: '/admin/assets', label: t('common.assets'), child: true, icon: 'i-lucide-package' },
      { to: '/admin/devices', label: t('common.devices'), child: true, icon: 'i-lucide-cpu' },
      { to: '/admin/machine', label: t('common.machines'), child: true, icon: 'i-lucide-cog' },
      { to: '/admin/register-codes', label: 'Register Code', child: true, icon: 'i-lucide-key-round' },
      { to: '/admin/device-keys', label: 'Device Keys', child: true, icon: 'i-lucide-key' }
    ]
  },
  {
    section: 'product-pricing',
    title: 'Product & Pricing',
    icon: 'i-lucide-tag',
    items: [
      { to: '/admin/promotion', label: 'Promotions', child: true, icon: 'i-lucide-badge-percent' },
      { to: '/admin/product', label: 'Products', child: true, icon: 'i-lucide-receipt-text' },
      { to: '/admin/product-types', label: 'Product Types', child: true, icon: 'i-lucide-tags' }
    ]
  },
  {
    section: 'commerce',
    title: 'Commerce',
    icon: 'i-lucide-shopping-cart',
    items: [
      { to: '/admin/orders', label: t('common.orders'), child: true, icon: 'i-lucide-clipboard-list' },
      { to: '/admin/payment', label: t('common.payments'), child: true, icon: 'i-lucide-credit-card' }
    ]
  },
  {
    section: 'connections',
    title: 'Connections',
    icon: 'i-lucide-link',
    items: [
      { to: '/admin/billers', label: 'Billers', child: true, icon: 'i-lucide-wallet' },
      { to: '/admin/provider', label: 'Provider Service', child: true, icon: 'i-lucide-network' },
      { to: '/admin/provider-connections', label: 'Provider Connection', child: true, icon: 'i-lucide-plug' }
    ]
  },
  {
    section: 'administration',
    title: 'Administration',
    icon: 'i-lucide-shield-check',
    items: [
      ...(isPlatformAdmin.value ? [{ to: '/admin/users', label: 'Users', child: true, icon: 'i-lucide-users' }] : []),
      { to: '/admin/settings', label: t('common.settings'), child: true, icon: 'i-lucide-settings' }
    ]
  }
])
</script>

<template>
  <div class="min-h-screen bg-slate-200 dark:bg-slate-800">
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div class="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div class="flex min-w-[180px] items-center">
          <AppBrandLogo />
        </div>
        <div class="flex min-w-[260px] justify-end">
          <UButton
            color="neutral"
            variant="ghost"
            :icon="sidebarOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
            class="mr-2"
            @click="sidebarOpen = !sidebarOpen"
          />
          <AppHeaderControls
            :show-sign-in="true"
            :show-profile="true"
            :show-settings="true"
            profile-path="/portal"
            settings-path="/admin/settings"
          />
        </div>
      </div>
    </header>

    <div
      class="grid min-h-[calc(100vh-66px)] grid-cols-1 transition-all duration-200"
      :class="sidebarOpen ? 'lg:grid-cols-[280px_1fr]' : 'lg:grid-cols-[88px_1fr]'"
    >
      <aside class="border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div class="space-y-2">
          <NuxtLink
            v-for="item in sidebarMenus[0]?.items || []"
            :key="item.to + item.label"
            :to="item.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <UIcon :name="item.icon" class="h-5 w-5 shrink-0" />
            <span v-if="sidebarOpen">{{ item.label }}</span>
          </NuxtLink>
          <div
            v-for="group in sidebarMenus.slice(1)"
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
