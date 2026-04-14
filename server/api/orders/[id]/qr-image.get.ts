import { createError, getQuery, getRouterParam, setHeader } from 'h3'
import { buildQrFallbackSvg, findOrderAssetPayload, renderQrPng } from '../../../utils/order-assets'

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const query = getQuery(event)

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  const order = await findOrderAssetPayload(orderId)
  const payload = order.paymentQrPayload || ''
  const shouldDownload = query.download === '1'
  const baseName = `${order.orderNumber || 'order'}-qr`

  try {
    const png = await renderQrPng(payload)
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'no-store, max-age=0')
    setHeader(event, 'Content-Disposition', `${shouldDownload ? 'attachment' : 'inline'}; filename="${baseName}.png"`)
    return png
  } catch {
    const svg = buildQrFallbackSvg(payload)
    setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
    setHeader(event, 'Cache-Control', 'no-store, max-age=0')
    setHeader(event, 'Content-Disposition', `${shouldDownload ? 'attachment' : 'inline'}; filename="${baseName}.svg"`)
    return svg
  }
})
