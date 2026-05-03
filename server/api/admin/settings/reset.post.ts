import { readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { deleteSystemSetting } from '../../../utils/system-settings'
import { isResettableSystemSetting, SYSTEM_SETTING_KEYS } from '../../../../shared/system-settings-catalog'

const schema = z.object({
  key: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  if (!isResettableSystemSetting(body.key)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This setting cannot be reset from UI.'
    })
  }

  await deleteSystemSetting(body.key)
  if (body.key === SYSTEM_SETTING_KEYS.paymentExpiryMinutes) {
    await deleteSystemSetting('admin.settings')
  }

  return {
    success: true,
    key: body.key
  }
})
