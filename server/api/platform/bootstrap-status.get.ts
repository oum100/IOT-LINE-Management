import { prisma } from '../../utils/prisma'
import { getPlatformState, isPlatformInitialized } from '../../utils/platform-state'

export default defineEventHandler(async () => {
  const platformState = await getPlatformState()
  const platformInitialized = await isPlatformInitialized()
  const adminCount = await prisma.user.count({
    where: {
      role: 'ADMIN'
    }
  })

  return {
    hasPlatformAdmin: adminCount > 0,
    platformInitialized,
    platformInitializedAt: platformState.platformInitializedAt || null,
    allowBootstrap: !platformInitialized && adminCount === 0
  }
})
