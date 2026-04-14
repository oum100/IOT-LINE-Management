type LineLiffProfile = {
  ready: boolean
  loading: boolean
  loggedIn: boolean
  isInClient: boolean
  userId: string
  displayName: string
  pictureUrl: string
  idToken: string
  accessToken: string
  verified: boolean
  verificationError: string
  error: string
}

const defaultProfile = (): LineLiffProfile => ({
  ready: false,
  loading: false,
  loggedIn: false,
  isInClient: false,
  userId: '',
  displayName: '',
  pictureUrl: '',
  idToken: '',
  accessToken: '',
  verified: false,
  verificationError: '',
  error: ''
})

export function useLineLiff() {
  const profile = useState<LineLiffProfile>('line-liff-profile', defaultProfile)

  async function verifyWithServer(payload: { idToken?: string, accessToken?: string, userId?: string }) {
    try {
      const verified = await $fetch<{
        userId: string
        displayName: string
        pictureUrl: string
      }>('/api/line/profile', {
        method: 'POST',
        body: payload
      })

      profile.value = {
        ...profile.value,
        userId: verified.userId || profile.value.userId,
        displayName: verified.displayName || profile.value.displayName,
        pictureUrl: verified.pictureUrl || profile.value.pictureUrl,
        verified: true,
        verificationError: ''
      }
    } catch (error) {
      profile.value = {
        ...profile.value,
        verified: false,
        verificationError: error instanceof Error ? error.message : 'LINE verification failed'
      }
    }
  }

  async function init(force = false) {
    if (!import.meta.client || profile.value.loading || (profile.value.ready && !force)) {
      return
    }

    const config = useRuntimeConfig()
    const liffId = config.public.lineLiffId

    if (!liffId) {
      profile.value = {
        ...profile.value,
        ready: true,
        error: 'LINE_LIFF_ID is not configured'
      }
      return
    }

    profile.value = {
      ...profile.value,
      loading: true,
      error: ''
    }

    try {
      const { default: liff } = await import('@line/liff')

      await liff.init({
        liffId
      })

      const isLoggedIn = liff.isLoggedIn()
      const isInClient = liff.isInClient()

      if (!isLoggedIn && !isInClient) {
        profile.value = {
          ...profile.value,
          ready: true,
          loading: false,
          loggedIn: false,
          isInClient: false,
          verified: false,
          verificationError: '',
          error: ''
        }
        return
      }

      const context = liff.getContext()
      const decoded = liff.getDecodedIDToken()
      const idToken = liff.getIDToken() || ''
      const accessToken = liff.getAccessToken() || ''

      let displayName = decoded?.name || ''
      let pictureUrl = decoded?.picture || ''
      let userId = context?.userId || decoded?.sub || ''

      if (isLoggedIn) {
        try {
          const liffProfile = await liff.getProfile()
          displayName = liffProfile.displayName || displayName
          pictureUrl = liffProfile.pictureUrl || pictureUrl
          userId = liffProfile.userId || userId
        } catch {
          // Fall back to decoded ID token/context when profile scope isn't available.
        }
      }

      profile.value = {
        ready: true,
        loading: false,
        loggedIn: isLoggedIn,
        isInClient,
        userId,
        displayName: displayName || 'คุณลูกค้า',
        pictureUrl,
        idToken,
        accessToken,
        verified: false,
        verificationError: '',
        error: ''
      }

      if (idToken || accessToken) {
        await verifyWithServer({
          idToken,
          accessToken,
          userId
        })
      }
    } catch (error) {
      profile.value = {
        ...profile.value,
        ready: true,
        loading: false,
        error: error instanceof Error ? error.message : 'LIFF initialization failed'
      }
    }
  }

  async function login() {
    if (!import.meta.client) {
      return
    }

    const config = useRuntimeConfig()
    const liffId = config.public.lineLiffId

    if (!liffId) {
      profile.value = {
        ...profile.value,
        error: 'LINE_LIFF_ID is not configured'
      }
      return
    }

    const { default: liff } = await import('@line/liff')

    await liff.init({
      liffId
    })

    const redirectUri = `${window.location.origin}${window.location.pathname}${window.location.search}`

    liff.login({
      redirectUri
    })
  }

  return {
    profile,
    init,
    login
  }
}
