import { getQuery } from 'h3'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { assertAdminAccess } from '../../../utils/admin-auth'
import { withPaging } from '../../../utils/admin-crud'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const query = getQuery(event)
  const { q, skip, take, page, pageSize } = withPaging(query)
  const orm = prisma as any

  const andWhere: Prisma.BillerProfileWhereInput[] = []

  if (query.tenantId) {
    andWhere.push({ tenantId: String(query.tenantId) })
  }

  if (query.merchantAccountId) {
    const merchantAccountId = String(query.merchantAccountId)
    andWhere.push({
      OR: [
        { merchantBindings: { some: { merchantAccountId } } },
        { branchBindings: { some: { branch: { merchantAccountId } } } }
      ]
    })
  }

  if (query.branchId) {
    andWhere.push({
      branchBindings: {
        some: {
          branchId: String(query.branchId)
        }
      }
    })
  }

  if (q) {
    andWhere.push({
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { billerId: { contains: q, mode: 'insensitive' } },
        { providerCode: { equals: q as any } }
      ]
    })
  }

  const where: Prisma.BillerProfileWhereInput = andWhere.length ? { AND: andWhere } : {}

  const [items, total] = await Promise.all([
    orm.billerProfile.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      skip,
      take,
      select: {
        id: true,
        tenantId: true,
        code: true,
        displayName: true,
        providerCode: true,
        integrationMode: true,
        status: true,
        priority: true,
        billerId: true,
        providerConnectionId: true,
        slipVerifyConnectionId: true,
        accountName: true,
        bankName: true,
        accountNumber: true,
        promptPayTarget: true,
        shopId: true,
        config: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        providerConnection: {
          select: {
            id: true,
            code: true,
            displayName: true,
            providerCode: true,
            status: true
          }
        },
        slipVerifyConnection: {
          select: {
            id: true,
            code: true,
            displayName: true,
            providerCode: true,
            status: true
          }
        },
        tenantBindings: {
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            priority: true,
            active: true,
            isDefault: true
          }
        },
        merchantBindings: {
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            merchantAccountId: true,
            priority: true,
            active: true,
            merchantAccount: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        branchBindings: {
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            branchId: true,
            priority: true,
            active: true,
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
                merchantAccountId: true
              }
            }
          }
        },
        _count: {
          select: {
            payments: true,
            tenantBindings: true,
            merchantBindings: true,
            branchBindings: true
          }
        }
      }
    }),
    orm.billerProfile.count({ where })
  ])

  return {
    items: items.map((item: any) => {
      const config = ((item.config as Record<string, unknown> | null) || {})
      const linkedCount = item._count.payments + item._count.tenantBindings + item._count.merchantBindings + item._count.branchBindings
      return {
        ...item,
        accountName: item.accountName || (typeof config.accountName === 'string' ? config.accountName : null),
        bankName: item.bankName || (typeof config.bankName === 'string' ? config.bankName : null),
        accountNumber: item.accountNumber || (typeof config.accountNumber === 'string' ? config.accountNumber : null),
        promptPayTarget: item.promptPayTarget || (typeof config.promptPayTarget === 'string' ? config.promptPayTarget : null),
        qrPaymentMode: typeof config.qrPaymentMode === 'string' ? config.qrPaymentMode : null,
        maeManeeShopId: item.shopId || (typeof config.maeManeeShopId === 'string' ? config.maeManeeShopId : null),
        providerConnectionId: item.providerConnectionId || null,
        providerConnection: item.providerConnection || null,
        slipVerifyConnectionId: item.slipVerifyConnectionId || null,
        slipVerificationProvider: item.slipVerifyConnection?.displayName || item.slipVerifyConnection?.providerCode || (typeof config.slipVerificationProvider === 'string' ? config.slipVerificationProvider : null),
        slipVerifyConnection: item.slipVerifyConnection || null,
        canDelete: linkedCount === 0,
        linkedCount
      }
    }),
    total,
    page,
    pageSize
  }
})
