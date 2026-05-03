<script setup lang="ts">
const route = useRoute()
const branchCode = computed(() => String(route.params.branchCode || '').trim())

if (import.meta.server) {
  await navigateTo(`/order?branchCode=${encodeURIComponent(branchCode.value)}`, { redirectCode: 302 })
} else {
  await navigateTo(`/order?branchCode=${encodeURIComponent(branchCode.value)}`)
}
</script>

<template>
  <div class="p-4 text-sm text-slate-500">Redirecting...</div>
</template>

