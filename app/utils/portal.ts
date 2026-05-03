export type AppPortal = 'platform' | 'tenant'

export type AppRole = 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF' | string | null | undefined

export function resolvePortalFromRole(role: AppRole): AppPortal {
  const normalized = String(role || '').toUpperCase()
  if (normalized === 'ADMIN' || normalized === 'USER') {
    return 'platform'
  }
  return 'tenant'
}

export function resolvePortalHome(role: AppRole) {
  return resolvePortalFromRole(role) === 'platform' ? '/platform/dashboard' : '/app/dashboard'
}
