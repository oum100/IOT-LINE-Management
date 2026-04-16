export type AppPortal = 'platform' | 'tenant'

export type AppRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_STAFF' | 'ADMIN' | 'USER' | string | null | undefined

export function resolvePortalFromRole(role: AppRole): AppPortal {
  const normalized = String(role || '').toUpperCase()
  if (normalized === 'PLATFORM_ADMIN' || normalized === 'ADMIN') {
    return 'platform'
  }
  return 'tenant'
}

export function resolvePortalHome(role: AppRole) {
  return resolvePortalFromRole(role) === 'platform' ? '/platform/dashboard' : '/app/dashboard'
}
