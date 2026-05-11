<script setup lang="ts">
const route = useRoute()
const { getLocales } = useI18n()

const localeCodes = computed(() => new Set(getLocales().map(locale => locale.code.toLowerCase())))

function stripLocalePrefix(path: string) {
  const normalized = path.toLowerCase()
  const segments = normalized.split('/').filter(Boolean)
  const first = segments[0]

  if (!first || !localeCodes.value.has(first)) {
    return normalized
  }

  const rest = segments.slice(1).join('/')
  return rest ? `/${rest}` : '/'
}

const layoutName = computed(() => {
  if (route.meta?.layout === false) {
    return false
  }

  if (typeof route.meta?.layout === 'string' && route.meta.layout.length > 0) {
    return route.meta.layout
  }

  const path = stripLocalePrefix(route.path)
  if (path.startsWith('/auth') || path === '/login' || path === '/signup') {
    return 'auth'
  }
  if (path.startsWith('/platform') || path.startsWith('/admin')) {
    return 'admin'
  }
  if (path.startsWith('/app')) {
    return 'tenant'
  }
  return 'default'
})
</script>

<template>
  <NuxtLayout v-if="layoutName !== false" :name="layoutName">
    <NuxtPage />
  </NuxtLayout>
  <NuxtPage v-else />
</template>
