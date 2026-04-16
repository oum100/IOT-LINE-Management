<script setup lang="ts">
const { t } = useI18n()

const sidebarMenus = computed(() => [
  { to: '/platform/dashboard', label: t('common.dashboard') },
  { to: '/admin/tenant', label: 'Tenant Management' },
  { to: '/admin/settings', label: t('common.settings') }
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

    <div class="grid min-h-[calc(100vh-66px)] grid-cols-1 lg:grid-cols-[260px_1fr]">
      <aside class="border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <nav class="space-y-1.5">
          <NuxtLink
            v-for="item in sidebarMenus"
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
