import { createError, readBody } from 'h3'
import { z } from 'zod'
import { resolveBranchByCode } from '../../utils/branch-resolver'
import { verifyLineIdentity } from '../../utils/line-login'
import { upsertLineMember } from '../../utils/line-members'

const schema = z.object({
  idToken: z.string().optional(),
  accessToken: z.string().optional(),
  userId: z.string().optional(),
  branchCode: z.string().optional()
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

  const verified = await verifyLineIdentity({
    liffId: config.public.lineLiffId,
    idToken: body.idToken,
    accessToken: body.accessToken,
    userId: body.userId,
    channelAccessToken: config.lineChannelAccessToken
  })

  const branchCode = String(body.branchCode || '').trim()
  if (branchCode && verified.userId) {
    const branch = await resolveBranchByCode(branchCode)
    await upsertLineMember({
      lineUserId: verified.userId,
      tenantId: branch.tenantId,
      merchantAccountId: branch.merchantAccountId,
      branchId: branch.id,
      displayName: verified.displayName || null,
      pictureUrl: verified.pictureUrl || null,
      liffId: config.public.lineLiffId || null
    })
  }

  return verified
})
