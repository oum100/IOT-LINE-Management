import { nanoid } from 'nanoid'
import { createError, readBody } from 'h3'
import { MachineStatus } from '@prisma/client'
import { orderCounter } from '../../utils/metrics'
import { demoMachines } from '../../utils/demo-data'
import { createMockOrder } from '../../utils/mock-orders'
import { buildPromptPayPayload } from '../../utils/payment'
import { resolvePaymentExpiryMinutes } from '../../utils/payment-expiry'
import { prisma } from '../../utils/prisma'
import { createOrderSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event)
  const body = createOrderSchema.parse({
    ...rawBody,
    customerName: String(rawBody?.customerName || '').trim() || 'คุณลูกค้า'
  })
  const config = useRuntimeConfig()
  const expiryMinutes = await resolvePaymentExpiryMinutes(event)

  try {
    const selectedPriceIds = body.items.map(item => item.priceId)
    const selectedMachineIds = body.items.map(item => item.machineId)
    const uniqueMachineIds = Array.from(new Set(selectedMachineIds))
    const orderNumber = `ORD-${nanoid(8).toUpperCase()}`
    const paymentDeadlineAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    const created = await prisma.$transaction(async (tx) => {
      const machines = await tx.machine.findMany({
        where: {
          id: { in: uniqueMachineIds }
        }
      })

      if (machines.length !== uniqueMachineIds.length) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Some selected machines no longer exist'
        })
      }

      const unavailableMachines = machines.filter(machine => machine.status !== MachineStatus.AVAILABLE)
      if (unavailableMachines.length) {
        const first = unavailableMachines[0]
        if (!first) {
          throw createError({
            statusCode: 409,
            statusMessage: 'One or more machines are no longer available'
          })
        }
        throw createError({
          statusCode: 409,
          statusMessage: `${first.name} is no longer available`
        })
      }

      const prices = await tx.machinePrice.findMany({
        where: {
          id: { in: selectedPriceIds },
          machineId: { in: selectedMachineIds }
        },
        include: {
          machine: true
        }
      })

      if (prices.length !== body.items.length) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Some selected price options no longer exist'
        })
      }

      const totalAmount = prices.reduce((sum, item) => sum + item.amount, 0)
      const qrPayload = buildPromptPayPayload({
        mode: config.qrPaymentMode,
        target: config.promptPayTarget,
        amount: totalAmount,
        orderNumber,
        lineUserId: body.lineUserId,
        billerId: config.maeManeeBillerId,
        referencePrefix: config.maeManeeReferencePrefix,
        templatePayload: config.maeManeeTemplatePayload
      })

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: body.customerName,
          lineUserId: body.lineUserId || null,
          note: body.note || null,
          totalAmount,
          createdAt: new Date(),
          items: {
            create: body.items.map((item) => {
              const price = prices.find(entry => entry.id === item.priceId && entry.machineId === item.machineId)

              if (!price) {
                throw createError({ statusCode: 400, statusMessage: 'Invalid machine and price selection' })
              }

              return {
                machineId: item.machineId,
                priceId: price.id,
                priceLabel: price.label,
                amount: price.amount,
                durationMinutes: price.durationMinutes
              }
            })
          },
          payment: {
            create: {
              amount: totalAmount,
              qrPayload
            }
          }
        }
      })

      await tx.machine.updateMany({
        where: {
          id: { in: uniqueMachineIds }
        },
        data: {
          status: MachineStatus.RESERVED,
          remainingMinutes: expiryMinutes
        }
      })

      return {
        order,
        totalAmount
      }
    })

    orderCounter.inc()

    return {
      orderId: created.order.id,
      orderNumber,
      paymentDeadlineAt: paymentDeadlineAt.toISOString(),
      paymentExpiryMinutes: expiryMinutes
    }
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode) {
      throw error
    }

    console.warn('create order fallback to test mode', error)

    const availableDemoMachines = demoMachines.filter(machine => machine.status === 'AVAILABLE')
    const selections = body.items.flatMap((item, index) => {
      const directMachine = demoMachines.find(entry => entry.id === item.machineId)

      if (directMachine) {
        const directPrice = directMachine.prices.find(price => price.id === item.priceId) || directMachine.prices[0]

        if (!directPrice) {
          return []
        }

        return [{ machine: directMachine, priceId: directPrice.id }]
      }

      const fallbackMachine = availableDemoMachines[index % availableDemoMachines.length]

      if (!fallbackMachine) {
        return []
      }

      const normalizedPriceIndex =
        item.priceId.includes('p3') ? 2 :
        item.priceId.includes('p2') ? 1 :
        0
      const fallbackPrice = fallbackMachine.prices[normalizedPriceIndex] || fallbackMachine.prices[0]

      if (!fallbackPrice) {
        return []
      }

      return [{ machine: fallbackMachine, priceId: fallbackPrice.id }]
    })

    if (!selections.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Unable to create test order from current selections'
      })
    }

    const totalAmount = selections.reduce((sum, selection) => {
      const price = selection.machine.prices.find(entry => entry.id === selection.priceId)
      return sum + (price?.amount || 0)
    }, 0)

    const qrPayload = buildPromptPayPayload({
      mode: config.qrPaymentMode,
      target: config.promptPayTarget || '0812345678',
      amount: totalAmount,
      orderNumber: `TEST-${nanoid(8).toUpperCase()}`,
      lineUserId: body.lineUserId,
      billerId: config.maeManeeBillerId,
      referencePrefix: config.maeManeeReferencePrefix,
      templatePayload: config.maeManeeTemplatePayload
    })
    const order = await createMockOrder({
      customerName: body.customerName,
      lineUserId: body.lineUserId,
      note: body.note,
      selections,
      qrPayload,
      paymentExpiryMinutes: expiryMinutes
    })

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentDeadlineAt: order.paymentDeadlineAt,
      paymentExpiryMinutes: expiryMinutes,
      mode: 'test'
    }
  }
})
