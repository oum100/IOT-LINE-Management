import { createError, getQuery, getRouterParam, setHeader } from 'h3'
import { buildReceiptSvg, findOrderAssetPayload } from '../../../utils/order-assets'

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const query = getQuery(event)

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  const order = await findOrderAssetPayload(orderId)
  const svg = buildReceiptSvg(order)
  const shouldDownload = query.download === '1'
  const fileName = `${order.orderNumber || 'order'}-receipt.svg`

  setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-store, max-age=0')
  setHeader(event, 'Content-Disposition', `${shouldDownload ? 'attachment' : 'inline'}; filename="${fileName}"`)

  return svg
})
