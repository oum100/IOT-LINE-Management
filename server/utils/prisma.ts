import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function hasRequiredDelegates(client: PrismaClient | undefined) {
  if (!client) return false
  const delegates = client as unknown as { expense?: unknown; providerService?: unknown }
  return Boolean(delegates.expense && delegates.providerService)
}

let prismaInstance = globalForPrisma.prisma
if (!prismaInstance || !hasRequiredDelegates(prismaInstance)) {
  prismaInstance = new PrismaClient()
}

export const prisma = prismaInstance

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
