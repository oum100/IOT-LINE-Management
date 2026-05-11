import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const orm = prisma as any
  const [tenants, servers, bindings] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, status: true }
    }),
    orm.mqttServer.findMany({
      where: { status: { in: ['ACTIVE', 'INACTIVE'] } },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, status: true }
    }),
    orm.tenantMqttBinding.findMany({
      include: {
        tenant: { select: { id: true, code: true, name: true } },
        mqttServer: { select: { id: true, code: true, name: true } }
      },
      orderBy: { updatedAt: 'desc' }
    })
  ])

  return { tenants, servers, bindings }
})
