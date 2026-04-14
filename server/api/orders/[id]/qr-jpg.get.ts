import { createError, getQuery, getRouterParam, setHeader } from 'h3'
import { buildQrFallbackSvg, findOrderAssetPayload, renderPromptPayCardJpeg } from '../../../utils/order-assets'

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const query = getQuery(event)

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  const order = await findOrderAssetPayload(orderId)
  const shouldDownload = query.download === '1'
  const baseName = `${order.orderNumber || 'order'}-promptpay`

  try {
    const jpg = await renderPromptPayCardJpeg(order)
    setHeader(event, 'Content-Type', 'image/jpeg')
    setHeader(event, 'Cache-Control', 'no-store, max-age=0')
    setHeader(event, 'Content-Disposition', `${shouldDownload ? 'attachment' : 'inline'}; filename="${baseName}.jpg"`)
    return jpg
  } catch {
    const svg = buildQrFallbackSvg(order.paymentQrPayload || '')
    setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
    setHeader(event, 'Cache-Control', 'no-store, max-age=0')
    setHeader(event, 'Content-Disposition', `${shouldDownload ? 'attachment' : 'inline'}; filename="${baseName}.svg"`)
    return svg
  }
})
