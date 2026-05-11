<script setup lang="ts">
definePageMeta({
  middleware: "portal-auth",
})

await navigateTo("/admin/merchants")
</script>

<template>
  <div />
</template>
