<script setup lang="ts">
definePageMeta({
  middleware: 'portal-auth'
})

await navigateTo('/app/dashboard')
</script>

<template>
  <div />
</template>
