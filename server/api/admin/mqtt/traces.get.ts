import { getQuery } from 'h3'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const tenantId = String(query.tenantId || '').trim()
  const direction = String(query.direction || '').trim()
  const take = Math.min(200, Math.max(1, Number(query.take || 50)))

  const orm = prisma as any
  const where: Record<string, unknown> = {
    ...(tenantId ? { tenantId } : {}),
    ...(direction ? { direction } : {})
  }

  const items = await orm.mqttTrace.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      tenant: { select: { id: true, code: true, name: true } },
      mqttServer: { select: { id: true, code: true, name: true } }
    }
  })

  return { items }
})
