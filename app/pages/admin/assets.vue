<script setup lang="ts">
definePageMeta({
  middleware: 'portal-auth'
})

await navigateTo('/admin/tenant')
</script>

<template>
  <div />
</template>
