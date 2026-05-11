import { createError, getRouterParam } from 'h3'
import { completeOrder } from '../../../utils/order-workflow'
import { assertAnyPermission } from '../../../utils/rbac'

export default defineEventHandler(async (event) => {
  await assertAnyPermission(event, ['platform.order.manage', 'portal.order.manage'])
  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  await completeOrder(orderId)

  return {
    success: true
  }
})
