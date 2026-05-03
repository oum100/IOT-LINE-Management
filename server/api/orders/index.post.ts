import { nanoid } from 'nanoid'
import { createError, readBody } from 'h3'
import { MachineStatus } from '@prisma/client'
import { orderCounter } from '../../utils/metrics'
import { demoMachines } from '../../utils/demo-data'
import { createMockOrder } from '../../utils/mock-orders'
import { generateOrderSelfCancelToken, hashOrderSelfCancelToken } from '../../utils/order-self-cancel'
import { buildPromptPayPayload } from '../../utils/payment'
import { resolvePaymentExpiryMinutes } from '../../utils/payment-expiry'
import { prisma } from '../../utils/prisma'
import { resolveMaeManeeReferencePrefix, resolveQrPaymentMode } from '../../utils/system-config'
import { resolveBillerProfileForOrder } from '../../utils/biller-routing'
import { issueProviderQr } from '../../utils/provider-qr'
import { createOrderSchema } from '../../utils/validation'
import { resolveBranchByCode } from '../../utils/branch-resolver'
import { upsertLineMember } from '../../utils/line-members'

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event)
  const body = createOrderSchema.parse({
    ...rawBody,
    customerName: String(rawBody?.customerName || '').trim() || 'คุณลูกค้า'
  })
  const config = useRuntimeConfig()
  const expiryMinutes = await resolvePaymentExpiryMinutes(event)
  const legacyQrPaymentMode = await resolveQrPaymentMode(event)
  const legacyMaeManeeReferencePrefix = await resolveMaeManeeReferencePrefix(event)
  const branchCtx = await resolveBranchByCode(body.branchCode)

  try {
    const selectedAssetPriceIds = body.items.map(item => item.priceId)
    const selectedMachineIds = body.items.map(item => item.machineId)
    const uniqueMachineIds = Array.from(new Set(selectedMachineIds))
    const orderNumber = `ORD-${nanoid(8).toUpperCase()}`
    const selfCancelToken = generateOrderSelfCancelToken()
    const selfCancelTokenHash = hashOrderSelfCancelToken(selfCancelToken)
    const paymentDeadlineAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    const created = await prisma.$transaction(async (tx) => {
      const machines = await tx.machine.findMany({
        where: {
          id: { in: uniqueMachineIds },
          branchId: branchCtx.id
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

      const assetPrices = await tx.assetProductPrice.findMany({
        where: {
          id: { in: selectedAssetPriceIds },
          active: true
        },
        include: {
          product: true
        }
      })

      if (assetPrices.length !== body.items.length) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Some selected price options no longer exist'
        })
      }

      const machineIdsForLookup = machines.map(m => m.id)
      const machinePrices = await tx.machinePrice.findMany({
        where: { machineId: { in: machineIdsForLookup } },
        select: {
          id: true,
          machineId: true,
          amount: true,
          durationMinutes: true,
          sortOrder: true,
          label: true
        }
      })

      const totalAmount = assetPrices.reduce((sum, item) => sum + item.amount, 0)
      const routeContext = {
        tenantId: branchCtx.tenantId,
        merchantAccountId: branchCtx.merchantAccountId || null,
        branchId: branchCtx.id
      }
      const resolvedBiller = await resolveBillerProfileForOrder(routeContext)
      const qrPaymentMode = resolvedBiller?.qrPaymentMode || legacyQrPaymentMode
      const maeManeeReferencePrefix = legacyMaeManeeReferencePrefix
      const providerQrEnabled =
        resolvedBiller?.integrationMode === 'PROVIDER_QR' &&
        Boolean(resolvedBiller.providerConnection?.supportsQrIssue) &&
        Boolean(resolvedBiller.providerConnection?.baseUrl)

      if (resolvedBiller?.integrationMode === 'PROVIDER_QR' && !providerQrEnabled) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Provider QR is configured but provider connection is not ready'
        })
      }

      const providerCallbackUrl =
        config.public?.appBaseUrl
          ? `${String(config.public.appBaseUrl).replace(/\/+$/, '')}/api/payments/provider-callback`
          : null

      const providerQr = providerQrEnabled
        ? await issueProviderQr({
            baseUrl: resolvedBiller?.providerConnection?.baseUrl || '',
            appKey: resolvedBiller?.providerConnection?.appKey || null,
            appSecret: resolvedBiller?.providerConnection?.appSecret || null,
            credentials: (resolvedBiller?.providerConnection?.credentials || null) as Record<string, unknown> | null,
            orderNumber,
            amount: totalAmount,
            customerName: body.customerName,
            tenantId: routeContext.tenantId,
            merchantAccountId: routeContext.merchantAccountId,
            branchId: routeContext.branchId,
            callbackUrl: providerCallbackUrl
          })
        : null

      const qrPayload = providerQr?.qrPayload || buildPromptPayPayload({
        mode: qrPaymentMode,
        target: resolvedBiller?.promptPayTarget || config.promptPayTarget,
        amount: totalAmount,
        orderNumber,
        lineUserId: body.lineUserId,
        billerId: resolvedBiller?.billerId || config.maeManeeBillerId,
        referencePrefix: maeManeeReferencePrefix,
        templatePayload: config.maeManeeTemplatePayload
      })

      const order = await tx.order.create({
        data: {
          orderNumber,
          tenantId: routeContext.tenantId,
          merchantAccountId: routeContext.merchantAccountId,
          branchId: routeContext.branchId,
          customerName: body.customerName,
          lineUserId: body.lineUserId || null,
          note: body.note || null,
          selfCancelTokenHash,
          selfCancelTokenIssuedAt: new Date(),
          totalAmount,
          createdAt: new Date(),
          items: {
            create: body.items.map((item) => {
              const machine = machines.find(entry => entry.id === item.machineId)
              if (!machine?.assetId) {
                throw createError({ statusCode: 400, statusMessage: 'Selected machine has no asset mapping' })
              }
              const assetPrice = assetPrices.find(entry => entry.id === item.priceId && entry.assetId === machine.assetId)
              if (!assetPrice) {
                throw createError({ statusCode: 400, statusMessage: 'Selected product is not bound to this asset' })
              }

              const candidates = machinePrices.filter(entry => entry.machineId === item.machineId)
              const matchedMachinePrice =
                candidates.find(entry => entry.sortOrder === assetPrice.sortOrder) ||
                candidates.find(entry => entry.amount === assetPrice.amount && entry.durationMinutes === assetPrice.durationMinutes) ||
                candidates[0]

              if (!matchedMachinePrice) {
                throw createError({ statusCode: 400, statusMessage: 'Machine price mapping is not configured' })
              }

              return {
                machineId: item.machineId,
                assetId: machine.assetId,
                productId: assetPrice.productId,
                priceId: matchedMachinePrice.id,
                priceLabel: assetPrice.product?.name || matchedMachinePrice.label,
                amount: assetPrice.amount,
                durationMinutes: assetPrice.durationMinutes,
                serviceModeSnapshot: assetPrice.serviceMode,
                unitSnapshot: assetPrice.serviceUnit,
                quantitySnapshot: assetPrice.quantity
              }
            })
          },
          payment: {
            create: {
              amount: totalAmount,
              tenantId: routeContext.tenantId,
              merchantAccountId: routeContext.merchantAccountId,
              branchId: routeContext.branchId,
              billerProfileId: resolvedBiller?.billerProfileId || null,
              providerCode: resolvedBiller?.providerCode || (qrPaymentMode === 'promptpay' ? 'PROMPTPAY' : 'MAEMANEE'),
              providerPaymentIntentId: providerQr?.providerPaymentIntentId || null,
              providerReference: providerQr?.providerReference || null,
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
    if (body.lineUserId) {
      await upsertLineMember({
        lineUserId: body.lineUserId,
        tenantId: branchCtx.tenantId,
        merchantAccountId: branchCtx.merchantAccountId,
        branchId: branchCtx.id,
        displayName: body.customerName || null,
        liffId: config.public.lineLiffId || null
      })
    }

    return {
      orderId: created.order.id,
      orderNumber,
      selfCancelToken,
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
      mode: legacyQrPaymentMode,
      target: config.promptPayTarget || '0812345678',
      amount: totalAmount,
      orderNumber: `TEST-${nanoid(8).toUpperCase()}`,
      lineUserId: body.lineUserId,
      billerId: config.maeManeeBillerId,
      referencePrefix: legacyMaeManeeReferencePrefix,
      templatePayload: config.maeManeeTemplatePayload
    })
    const selfCancelToken = generateOrderSelfCancelToken()
    const order = await createMockOrder({
      customerName: body.customerName,
      lineUserId: body.lineUserId,
      note: body.note,
      selfCancelTokenHash: hashOrderSelfCancelToken(selfCancelToken),
      selections,
      qrPayload,
      paymentExpiryMinutes: expiryMinutes
    })

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      selfCancelToken,
      paymentDeadlineAt: order.paymentDeadlineAt,
      paymentExpiryMinutes: expiryMinutes,
      mode: 'test'
    }
  }
})
