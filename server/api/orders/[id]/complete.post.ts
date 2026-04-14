import { createError, getRouterParam } from 'h3'
import { completeOrder } from '../../../utils/order-workflow'

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  await completeOrder(orderId)

  return {
    success: true
  }
})
