import { createError } from 'h3'

type VerifyIdTokenResponse = {
  sub?: string
  name?: string
  picture?: string
  aud?: string
}

type UserInfoResponse = {
  sub?: string
  name?: string
  picture?: string
}

type LineProfileResponse = {
  userId?: string
  displayName?: string
  pictureUrl?: string
}

type BotProfileResponse = {
  userId?: string
  displayName?: string
  pictureUrl?: string
}

function getChannelIdFromLiffId(liffId: string) {
  return liffId.split('-')[0] || ''
}

export async function verifyLineIdentity(input: {
  liffId: string
  idToken?: string
  accessToken?: string
  userId?: string
  channelAccessToken?: string
}) {
  const channelId = getChannelIdFromLiffId(input.liffId)

  if (!channelId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Unable to derive LINE channel ID from LIFF ID'
    })
  }

  let verifiedUserId = input.userId || ''
  let displayName = ''
  let pictureUrl = ''
  let verified = false

  if (input.idToken) {
    try {
      const verifyResponse = await $fetch<VerifyIdTokenResponse>('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        body: new URLSearchParams({
          id_token: input.idToken,
          client_id: channelId,
          ...(input.userId ? { user_id: input.userId } : {})
        })
      })

      verifiedUserId = verifyResponse.sub || verifiedUserId
      displayName = verifyResponse.name || displayName
      pictureUrl = verifyResponse.picture || pictureUrl
      verified = true
    } catch {
      // Keep LIFF-provided fallback values when LINE verify endpoint is unavailable.
    }
  }

  if (input.accessToken) {
    try {
      const userInfo = await $fetch<UserInfoResponse>('https://api.line.me/oauth2/v2.1/userinfo', {
        headers: {
          Authorization: `Bearer ${input.accessToken}`
        }
      })

      verifiedUserId = userInfo.sub || verifiedUserId
      displayName = userInfo.name || displayName
      pictureUrl = userInfo.picture || pictureUrl
      verified = true
    } catch {
      // Keep LIFF-provided fallback values.
    }

    try {
      const profile = await $fetch<LineProfileResponse>('https://api.line.me/v2/profile', {
        headers: {
          Authorization: `Bearer ${input.accessToken}`
        }
      })

      verifiedUserId = profile.userId || verifiedUserId
      displayName = profile.displayName || displayName
      pictureUrl = profile.pictureUrl || pictureUrl
      verified = true
    } catch {
      // Ignore profile endpoint errors when userinfo already succeeded.
    }
  }

  if (!verifiedUserId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unable to verify LINE identity'
    })
  }

  if ((!displayName || !pictureUrl) && input.channelAccessToken) {
    try {
      const botProfile = await $fetch<BotProfileResponse>(`https://api.line.me/v2/bot/profile/${verifiedUserId}`, {
        headers: {
          Authorization: `Bearer ${input.channelAccessToken}`
        }
      })

      displayName = botProfile.displayName || displayName
      pictureUrl = botProfile.pictureUrl || pictureUrl
    } catch {
      // Keep existing values if bot profile is unavailable for this user.
    }
  }

  return {
    userId: verifiedUserId,
    displayName,
    pictureUrl,
    verified
  }
}
