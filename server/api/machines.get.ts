import { MachineStatus, OrderItemStatus, OrderStatus, PaymentStatus } from '@prisma/client'
import { demoMachines } from '../utils/demo-data'
import { reconcileRunningOrderItems } from '../utils/order-workflow'
import { resolvePaymentExpiryMinutes } from '../utils/payment-expiry'
import { prisma } from '../utils/prisma'

export default defineEventHandler(async (event) => {
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

    const machines = await prisma.machine.findMany({
      orderBy: { code: 'asc' },
      include: {
        prices: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    if (!machines.length) {
      console.warn('using demo machines because database has no machines')
      return demoMachines
    }

    return machines
  } catch (error) {
    console.warn('using demo machines because database is unavailable', error)
    return demoMachines
  }
})
