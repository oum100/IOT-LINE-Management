import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function hasRequiredDelegates(client: PrismaClient | undefined) {
  if (!client) return false
  const delegates = client as unknown as {
    expense?: unknown
    providerService?: unknown
    mqttServer?: unknown
    tenantMqttBinding?: unknown
    paymentTrace?: unknown
  }
  return Boolean(
    delegates.expense &&
    delegates.providerService &&
    delegates.mqttServer &&
    delegates.tenantMqttBinding &&
    delegates.paymentTrace
  )
}

let prismaInstance = globalForPrisma.prisma
if (!prismaInstance || !hasRequiredDelegates(prismaInstance)) {
  prismaInstance = new PrismaClient()
}

export const prisma = prismaInstance

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
