import { createError, readBody } from 'h3'
import { z } from 'zod'
import { verifyLineIdentity } from '../../utils/line-login'

const schema = z.object({
  idToken: z.string().optional(),
  accessToken: z.string().optional(),
  userId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const config = useRuntimeConfig(event)

  if (!config.public.lineLiffId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'LINE_LIFF_ID is not configured'
    })
  }

  if (!body.idToken && !body.accessToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing LINE token'
    })
  }

  return verifyLineIdentity({
    liffId: config.public.lineLiffId,
    idToken: body.idToken,
    accessToken: body.accessToken,
    userId: body.userId,
    channelAccessToken: config.lineChannelAccessToken
  })
})
