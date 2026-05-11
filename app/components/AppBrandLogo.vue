<script setup lang="ts">
const colorMode = useColorMode()

const logoSrc = computed(() => colorMode.value === 'dark'
  ? '/brand/washpoint-cute-small.png'
  : '/brand/washpoint-cute-small.png')
</script>

<template>
  <NuxtLink to="/" class="flex items-center gap-2">
    <img
      v-if="!colorMode.unknown"
      :src="logoSrc"
      alt="WashPoint"
      class="h-8 w-auto sm:h-9"
    >
    <div v-else class="h-8 w-[180px] sm:h-9" />
  </NuxtLink>
</template>
