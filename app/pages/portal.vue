<script setup lang="ts">
import { resolvePortalHome } from '~/utils/portal'

const { data, getSession } = useAuth()
await getSession()

const user = data.value?.user
if (!user) {
  await navigateTo('/login')
} else {
  await navigateTo(resolvePortalHome(user.role))
}
</script>

<template>
  <div />
</template>
