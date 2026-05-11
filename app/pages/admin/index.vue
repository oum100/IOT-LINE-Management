<script setup lang="ts">
definePageMeta({
  middleware: 'portal-auth'
})

await navigateTo('/admin/ops')
</script>

<template>
  <div />
</template>
