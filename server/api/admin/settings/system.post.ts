import { readBody } from 'h3'
import { z } from 'zod'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { setSystemSetting } from '../../../utils/system-settings'
import { SYSTEM_SETTING_KEYS } from '../../../../shared/system-settings-catalog'

const schema = z.object({
  defaultNewUserPassword: z.string().min(8).max(128),
  emailVerificationExpiryMinutes: z.number().int().min(1).max(1440),
  passwordResetExpiryMinutes: z.number().int().min(1).max(1440)
})

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const body = schema.parse(await readBody(event))

  await Promise.all([
    setSystemSetting(SYSTEM_SETTING_KEYS.defaultNewUserPassword, body.defaultNewUserPassword),
    setSystemSetting(SYSTEM_SETTING_KEYS.emailVerificationExpiryMinutes, body.emailVerificationExpiryMinutes),
    setSystemSetting(SYSTEM_SETTING_KEYS.passwordResetExpiryMinutes, body.passwordResetExpiryMinutes)
  ])

  return {
    success: true
  }
})
