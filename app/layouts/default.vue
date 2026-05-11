<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

type UNavigationMenuItem = NavigationMenuItem

const { ts } = useI18n()

const landingMenus = computed<UNavigationMenuItem[]>(() => [
  { to: '/', label: ts('common.home'), exact: true, exactHash: true, active: false },
  { to: '/#features', label: ts('common.features'), exact: true, exactHash: true, active: false },
  { to: '/#pricing', label: ts('common.pricing'), exact: true, exactHash: true, active: false },
  { to: '/#contact', label: ts('common.contact'), exact: true, exactHash: true, active: false }
])

</script>

<template>
  <div class="min-h-screen bg-slate-200 dark:bg-slate-800">
    <UDashboardNavbar
      :toggle="false"
      class="sticky top-0 z-40 h-15 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    >
      <template #leading>
        <div class="flex min-w-45 items-center pl-2 sm:pl-4 lg:pl-6">
          <AppBrandLogo />
        </div>
      </template>

      <template #default>
        <div class="hidden w-full justify-center md:flex">
          <UNavigationMenu
            :items="landingMenus"
            variant="pill"
            color="primary"
          />
        </div>
      </template>

      <template #right>
        <div class="flex items-center gap-2 pr-2 sm:pr-4 lg:pr-6">
          <LocaleModeControls />
          <UButton color="primary" variant="solid" size="sm" class="text-white" to="/login">
            {{ ts('common.signIn') }}
          </UButton>
        </div>
      </template>
    </UDashboardNavbar>

    <main>
      <slot />
    </main>
  </div>
</template>
