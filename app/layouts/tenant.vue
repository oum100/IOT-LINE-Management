<script setup lang="ts">
const tenantMenus = computed(() => [
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/revenue', label: 'Revenue' },
  { to: '/app/tenant', label: 'Tenant' },
  { to: '/admin/merchants', label: 'Merchant' },
  { to: '/admin/branchs', label: 'Branch' },
  { to: '/app/asset', label: 'Assets' }
])
</script>

<template>
  <div class="min-h-screen bg-slate-200 dark:bg-slate-800">
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div class="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div class="flex min-w-[180px] items-center">
          <AppBrandLogo />
        </div>
        <nav class="hidden flex-1 items-center justify-center gap-2 md:flex">
          <NuxtLink
            v-for="item in tenantMenus"
            :key="item.to + item.label"
            :to="item.to"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
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
    <main class="px-4 py-4 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
