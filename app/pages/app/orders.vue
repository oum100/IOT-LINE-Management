<script setup lang="ts">
definePageMeta({
  layout: 'tenant',
  middleware: 'portal-auth'
})
</script>

<template>
  <section class="space-y-4">
    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Operation</p>
          <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Orders</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Orders workspace is being prepared.</p>
        </div>
        <UBadge color="warning" variant="soft" size="md" class="font-semibold">Coming Soon</UBadge>
      </div>
    </UCard>
  </section>
</template>
