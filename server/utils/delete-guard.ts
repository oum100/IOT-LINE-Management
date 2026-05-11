import type { H3Event } from 'h3'

type DeleteConfirmBody = {
  confirmText?: string
  confirmName?: string
}

export async function requireDeleteConfirm(event: H3Event, expectedName?: string) {
  const body = ((await readBody(event)) || {}) as DeleteConfirmBody
  const confirmText = String(body.confirmText || '').trim().toUpperCase()
  if (confirmText !== 'DELETE') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Delete confirmation is required (confirmText=DELETE).'
    })
  }

  if (expectedName) {
    const confirmName = String(body.confirmName || '').trim()
    if (confirmName !== expectedName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Delete confirmation name mismatch.'
      })
    }
  }
}
