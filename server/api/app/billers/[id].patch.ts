import { assertPermission } from '../../../utils/rbac'

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.settings.manage')
  throw createError({ statusCode: 403, statusMessage: 'Biller profile is managed from platform only' })
})
