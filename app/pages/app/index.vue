<script setup lang="ts">
definePageMeta({
  middleware: 'portal-auth'
})

await navigateTo('/app/status')
</script>

<template>
  <div />
</template>
