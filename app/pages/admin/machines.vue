<script setup lang="ts">
definePageMeta({
  middleware: "portal-auth",
})

await navigateTo("/admin/machine")
</script>

<template>
  <div />
</template>
