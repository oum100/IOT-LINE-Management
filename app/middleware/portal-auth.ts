import { resolvePortalFromRole } from '~/utils/portal'

export default defineNuxtRouteMiddleware(async (to) => {
  const { data, status, getSession } = useAuth()
  const authStatus = status.value

  if (authStatus === 'loading') {
    await getSession()
  }

  const user = data.value?.user
  if (!user) {
    return navigateTo(`/login?callback=${encodeURIComponent(to.fullPath)}`)
  }

  const targetPortal = to.path.startsWith('/platform') || to.path.startsWith('/admin')
    ? 'platform'
    : to.path.startsWith('/app')
      ? 'tenant'
      : null
  if (!targetPortal) {
    return
  }

  const currentPortal = resolvePortalFromRole(user.role)
  if (currentPortal !== targetPortal) {
    return navigateTo(currentPortal === 'platform' ? '/platform/dashboard' : '/app/dashboard')
  }
})
