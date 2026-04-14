import { createError, getQuery, getRouterParam, setHeader } from 'h3'
import { buildLineReceiptSvg, findOrderAssetPayload, renderLineReceiptJpeg } from '../../../utils/order-assets'

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const query = getQuery(event)

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  const order = await findOrderAssetPayload(orderId)
  const svg = buildLineReceiptSvg(order)
  const jpg = await renderLineReceiptJpeg(svg)
  const shouldDownload = query.download === '1'
  const fileName = `${order.orderNumber || 'order'}-line-receipt.jpg`

  setHeader(event, 'Content-Type', 'image/jpeg')
  setHeader(event, 'Cache-Control', 'no-store, max-age=0')
  setHeader(event, 'Content-Disposition', `${shouldDownload ? 'attachment' : 'inline'}; filename="${fileName}"`)

  return jpg
})
