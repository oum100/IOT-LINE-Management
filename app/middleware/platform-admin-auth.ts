export default defineNuxtRouteMiddleware(async () => {
  const { data, status, getSession } = useAuth()

  if (status.value === 'loading') {
    await getSession()
  }

  const role = String(data.value?.user?.role || '').toUpperCase()
  if (role === 'ADMIN') {
    return
  }

  return navigateTo('/platform/dashboard')
})
