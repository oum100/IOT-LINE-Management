import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MachineStatus, OrderItemStatus, OrderStatus, PaymentStatus } from '@prisma/client'
import { createError, getQuery, getRouterParam, readMultipartFormData } from 'h3'
import { slipUploadCounter } from '../../../utils/metrics'
import { updateMockOrder } from '../../../utils/mock-orders'
import { sendCustomerNotification, sendOrderReceiptCardNotification } from '../../../utils/notifications'
import { startOrderMachines } from '../../../utils/order-workflow'
import { assertOrderBranchScope } from '../../../utils/order-branch-scope'
import { prisma } from '../../../utils/prisma'
import { verifySlipWithSlip2Go } from '../../../utils/slip2go'

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const branchCode = typeof query.branchCode === 'string' ? query.branchCode : ''

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  }

  const formData = await readMultipartFormData(event)
  const slip = formData?.find(item => item.name === 'slip')

  if (!slip?.data) {
    throw createError({ statusCode: 400, statusMessage: 'Slip file is required' })
  }

  const directory = join(process.cwd(), 'public', 'uploads', 'slips')
  await mkdir(directory, { recursive: true })

  const fileName = `${Date.now()}-${slip.filename || 'slip.bin'}`
  const filePath = join(directory, fileName)

  await writeFile(filePath, slip.data)

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true
      }
    })

    if (!order?.payment) {
      throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
    }
    await assertOrderBranchScope(order.branchId, branchCode)

    if (order.status === OrderStatus.CANCELLED) {
      throw createError({ statusCode: 409, statusMessage: 'Order is cancelled' })
    }

    const payment = order.payment
    const verification = await verifySlipWithSlip2Go({
      fileBuffer: slip.data,
      fileName,
      mimeType: slip.type,
      amount: payment.amount
    })

    await prisma.paymentSlip.create({
      data: {
        paymentId: payment.id,
        fileName,
        mimeType: slip.type,
        filePath: `/uploads/slips/${fileName}`
      }
    })

    if (verification.ok) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VERIFIED,
          verifiedAt: new Date(),
          rejectedNote: `${verification.code}: ${verification.message}`
        }
      })

      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED
        }
      })
    } else {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId },
        select: { machineId: true }
      })
      const machineIds = Array.from(new Set(orderItems.map(item => item.machineId)))

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REJECTED,
            rejectedNote: `${verification.code}: ${verification.message}`
          }
        })

        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CANCELLED
          }
        })

        await tx.orderItem.updateMany({
          where: {
            orderId,
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

    if (verification.ok) {
      const receiptOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              machine: true
            }
          }
        }
      })

      if (receiptOrder) {
        await sendOrderReceiptCardNotification({
          lineUserId: receiptOrder.lineUserId,
          customerName: receiptOrder.customerName,
          orderId: receiptOrder.id,
          orderNumber: receiptOrder.orderNumber,
          totalAmount: receiptOrder.totalAmount,
          items: receiptOrder.items.map(item => ({
            machineName: item.machine.name,
            durationMinutes: item.durationMinutes,
            amount: item.amount
          }))
        })
      } else {
        await sendCustomerNotification({
          lineUserId: order.lineUserId,
          customerName: order.customerName,
          message: `Payment verified for ${order.orderNumber}. Starting service now.`
        })
      }

      await startOrderMachines(orderId)
    }

    slipUploadCounter.inc()

    return {
      success: true,
      fileName,
      verification
    }
  } catch (error) {
    const updated = await updateMockOrder(orderId, (order) => ({
      ...order,
      status: 'SLIP_UPLOADED',
      payment: {
        ...order.payment,
        status: 'SLIP_UPLOADED',
        rejectedNote: 'TEST_MODE: Stored slip in test mode',
        slips: [
          {
            id: `slip_${Date.now()}`,
            fileName,
            filePath: `/uploads/slips/${fileName}`,
            uploadedAt: new Date().toISOString()
          },
          ...order.payment.slips
        ]
      }
    }))

    if (!updated) {
      throw error
    }

    slipUploadCounter.inc()

    return {
      success: true,
      fileName,
      verification: {
        ok: false,
        code: 'TEST_MODE',
        message: 'Stored slip in test mode'
      }
    }
  }
})
