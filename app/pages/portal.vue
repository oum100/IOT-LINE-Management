<script setup lang="ts">
import { resolvePortalHome } from '~/utils/portal'

const route = useRoute()
const { data, getSession } = useAuth()
await getSession()

if (route.path === '/portal') {
  const user = data.value?.user
  if (!user) {
    await navigateTo('/login')
  } else {
    const role = String(user.role || '').toUpperCase()
    const isPlatformUser = role === 'ADMIN' || role === 'USER'
    if (isPlatformUser) {
      await navigateTo('/platform/dashboard')
    } else if (!user.tenantId) {
      await navigateTo('/portal/new-user')
    } else {
      await navigateTo(resolvePortalHome(user.role))
    }
  }
}
</script>

<template>
  <NuxtPage />
</template>
