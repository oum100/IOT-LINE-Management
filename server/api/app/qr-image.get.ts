import { getQuery } from 'h3'
import { renderQrPng } from '../../utils/order-assets'
import { assertPermission } from '../../utils/rbac'

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  const text = String(getQuery(event).text || '').trim()
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Missing QR text' })

  const png = await renderQrPng(text)
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'no-store')
  return png
})
