<script setup lang="ts">
definePageMeta({
  middleware: 'portal-auth'
})

await navigateTo('/platform/dashboard')
</script>

<template>
  <div />
</template>
