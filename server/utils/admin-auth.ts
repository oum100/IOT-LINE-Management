import { createError, getHeader, type H3Event } from 'h3'
import { getServerSession } from '#auth'

async function hasAdminSession(event: H3Event) {
  try {
    const session = await getServerSession(event)
    const role = String((session?.user as { role?: string } | undefined)?.role || '').toUpperCase()
    return role === 'ADMIN'
  } catch {
    return false
  }
}

export async function assertAdminAccess(event: H3Event) {
  if (await hasAdminSession(event)) {
    return
  }

  const config = useRuntimeConfig(event)
  const requiredKey = config.adminApiKey || ''
  const headerKey = getHeader(event, 'x-admin-key') || ''

  if (!requiredKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized admin access (ADMIN_API_KEY is not configured)'
    })
  }

  if (!headerKey || headerKey !== requiredKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized admin access'
    })
  }
}
