<script setup lang="ts">
definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})

const settingMenus = [
  { to: '/app/user', label: 'User Management', description: 'Manage tenant users and scope assignments.', icon: 'i-lucide-users' },
  { to: '/app/promotion', label: 'Promotion Management', description: 'Manage current, upcoming, and history promotions.', icon: 'i-lucide-percent' }
]
</script>

<template>
  <section class="space-y-4">
    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Setting</p>
        <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Configuration and management modules.</p>
      </div>
    </UCard>

    <div class="grid gap-3 md:grid-cols-2">
      <UCard
        v-for="item in settingMenus"
        :key="item.to"
        :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-blue-400 dark:hover:ring-blue-500 transition' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-base font-semibold text-slate-900 dark:text-slate-100">{{ item.label }}</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">{{ item.description }}</p>
          </div>
          <UIcon :name="item.icon" class="mt-1 h-5 w-5 text-blue-600 dark:text-blue-300" />
        </div>
        <template #footer>
          <div class="flex justify-end">
            <UButton :to="item.to" color="primary" class="text-white">Open</UButton>
          </div>
        </template>
      </UCard>
    </div>
  </section>
</template>
