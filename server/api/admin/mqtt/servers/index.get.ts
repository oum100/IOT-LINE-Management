import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const orm = prisma as any
  const items = await orm.mqttServer.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { tenantBindings: true } }
    }
  })
  return {
    items: items.map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      host: item.host,
      port: item.port,
      protocol: item.protocol,
      username: item.username,
      tlsEnabled: !!item.tlsEnabled,
      qosMode: item.qosMode ?? 0,
      mqttVersion: item.mqttVersion ?? '3.1.1',
      connectTimeoutMs: item.connectTimeoutMs ?? 10000,
      keepAliveSec: item.keepAliveSec ?? 60,
      autoReconnect: item.autoReconnect ?? true,
      reconnectPeriodMs: item.reconnectPeriodMs ?? 3000,
      status: item.status,
      linkedTenants: item._count?.tenantBindings || 0,
      canDelete: (item._count?.tenantBindings || 0) === 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
  }
})
