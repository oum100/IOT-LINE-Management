import { MachineStatus, OrderItemStatus, OrderStatus, PaymentStatus } from '@prisma/client'
import { getQuery } from 'h3'
import { demoMachines } from '../utils/demo-data'
import { resolveBranchByCode } from '../utils/branch-resolver'
import { reconcileRunningOrderItems } from '../utils/order-workflow'
import { resolvePaymentExpiryMinutes } from '../utils/payment-expiry'
import { prisma } from '../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const branchCode = String(query.branchCode || '').trim()
  const branchScopeRequired = Boolean(branchCode)

  try {
    const expiryMinutes = await resolvePaymentExpiryMinutes(event)
    const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000)

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PENDING_PAYMENT, OrderStatus.SLIP_UPLOADED]
        },
        createdAt: {
          lt: cutoff
        },
        payment: {
          is: {
            status: {
              not: PaymentStatus.VERIFIED
            }
          }
        }
      },
      include: {
        payment: true,
        items: true
      }
    })

    for (const expired of expiredOrders) {
      const payment = expired.payment
      if (!payment) {
        continue
      }

      const machineIds = Array.from(new Set(expired.items.map(item => item.machineId)))

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REJECTED,
            rejectedNote: 'Payment timeout expired'
          }
        })

        await tx.order.update({
          where: { id: expired.id },
          data: {
            status: OrderStatus.CANCELLED
          }
        })

        await tx.orderItem.updateMany({
          where: {
            orderId: expired.id,
            status: {
              in: [OrderItemStatus.PENDING, OrderItemStatus.QUEUED, OrderItemStatus.RUNNING]
            }
          },
          data: {
            status: OrderItemStatus.FAILED,
            completedAt: new Date()
          }
        })

        if (machineIds.length) {
          await tx.machine.updateMany({
            where: {
              id: { in: machineIds }
            },
            data: {
              status: MachineStatus.AVAILABLE,
              remainingMinutes: null
            }
          })
        }
      })
    }

    await reconcileRunningOrderItems()

    const branchCtx = branchScopeRequired ? await resolveBranchByCode(branchCode) : null
    const machines = await prisma.machine.findMany({
      where: branchCtx ? { branchId: branchCtx.id } : undefined,
      orderBy: { code: 'asc' },
      include: {
        prices: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            label: true,
            amount: true,
            durationMinutes: true,
            sortOrder: true
          }
        },
        asset: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            prices: {
              where: { active: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                amount: true,
                durationMinutes: true,
                sortOrder: true,
                serviceMode: true,
                serviceUnit: true,
                quantity: true,
                product: {
                  select: {
                    code: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!machines.length && !branchScopeRequired) {
      console.warn('using demo machines because database has no machines')
      return demoMachines
    }

    return machines.map((machine) => {
      const asset = machine.asset
      const assetPrices = asset?.prices || []
      const prices = (machine.prices || []).map((price, idx) => {
        const mapped =
          assetPrices.find(ap => ap.sortOrder === price.sortOrder) ||
          assetPrices.find(ap => ap.amount === price.amount && ap.durationMinutes === price.durationMinutes) ||
          assetPrices[idx]
        const quantityNumber = mapped?.quantity == null ? null : Number(mapped.quantity)
        return {
          id: mapped?.id || price.id,
          machinePriceId: price.id,
          label: mapped?.product?.name || price.label,
          amount: mapped?.amount ?? price.amount,
          durationMinutes: mapped?.durationMinutes ?? price.durationMinutes,
          serviceMode: mapped?.serviceMode || 'TIME',
          serviceUnit: mapped?.serviceUnit || 'MINUTE',
          quantity: quantityNumber
        }
      })
      const assetStatus = asset?.status || 'INACTIVE'
      const mappedStatus =
        assetStatus === 'ACTIVE'
          ? 'AVAILABLE'
          : assetStatus === 'MAINTENANCE'
            ? 'MAINTENANCE'
            : 'RESERVED'
      return {
        ...machine,
        name: asset?.name || machine.name,
        code: asset?.code || machine.code,
        status: mappedStatus,
        assetStatus,
        prices
      }
    })
  } catch (error) {
    if (branchScopeRequired) {
      throw error
    }
    console.warn('using demo machines because database is unavailable', error)
    return demoMachines
  }
})
