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
import { logPaymentTrace } from '../../utils/payment-trace'
import { createOrderSchema } from '../../utils/validation'
import { resolveBranchByCode } from '../../utils/branch-resolver'
import { upsertLineMember } from '../../utils/line-members'

function pricingTypeRank(type: string) {
  if (type === 'PROMOTION') return 0
  if (type === 'SPECIAL') return 1
  return 2
}

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
    const orderNumber = `ORD-${nanoid(8).toUpperCase()}`
    const selfCancelToken = generateOrderSelfCancelToken()
    const selfCancelTokenHash = hashOrderSelfCancelToken(selfCancelToken)
    const paymentDeadlineAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    const created = await prisma.$transaction(async (tx) => {
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

      const selectedMachineIds = body.items.map(item => item.machineId).filter(Boolean) as string[]
      const uniqueMachineIds = Array.from(new Set(selectedMachineIds))
      const selectedAssetIds = body.items.map(item => item.assetId).filter(Boolean) as string[]
      const uniqueAssetIds = Array.from(new Set(selectedAssetIds))

      const [machines, assetMappedMachines] = await Promise.all([
        uniqueMachineIds.length
          ? tx.machine.findMany({
              where: {
                id: { in: uniqueMachineIds },
                branchId: branchCtx.id
              }
            })
          : Promise.resolve([]),
        uniqueAssetIds.length
          ? tx.machine.findMany({
              where: {
                assetId: { in: uniqueAssetIds },
                branchId: branchCtx.id,
                status: MachineStatus.AVAILABLE
              },
              select: { id: true, assetId: true }
            })
          : Promise.resolve([])
      ])

      if (machines.length !== uniqueMachineIds.length) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Some selected machines no longer exist'
        })
      }

      const isEffectivelyAvailable = (machine: { status: MachineStatus; remainingMinutes: number | null }) => {
        if (machine.status === MachineStatus.AVAILABLE) return true
        if (machine.status === MachineStatus.BOUND) return true
        if (
          machine.status === MachineStatus.RUNNING &&
          Number(machine.remainingMinutes ?? 0) <= 0
        ) {
          return true
        }
        return false
      }

      const unavailableMachines = machines.filter(machine => !isEffectivelyAvailable(machine))
      if (unavailableMachines.length) {
        const first = unavailableMachines[0]
        throw createError({
          statusCode: 409,
          statusMessage: first ? `${first.name} is no longer available` : 'One or more machines are no longer available'
        })
      }

      const assetToMachineMap = new Map<string, string>()
      for (const row of assetMappedMachines) {
        if (row.assetId && !assetToMachineMap.has(row.assetId)) {
          assetToMachineMap.set(row.assetId, row.id)
        }
      }

      const machineIdsForLookup = Array.from(new Set([
        ...machines.map(m => m.id),
        ...Array.from(assetToMachineMap.values())
      ]))
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

      const resolvedItemPairs = body.items.map((item) => {
        const machine = item.machineId ? machines.find(entry => entry.id === item.machineId) : null
        const resolvedAssetId = item.assetId || machine?.assetId || null
        if (!resolvedAssetId) {
          throw createError({ statusCode: 400, statusMessage: 'Selected machine has no asset mapping' })
        }
        const assetPrice = assetPrices.find(entry => entry.id === item.priceId && entry.assetId === resolvedAssetId)
        if (!assetPrice) {
          throw createError({ statusCode: 400, statusMessage: 'Selected product is not bound to this asset' })
        }
        return { machine, resolvedAssetId, assetPrice }
      })

      const now = new Date()
      const offerConditions = Array.from(new Set(
        resolvedItemPairs
          .filter(item => Boolean(item.assetPrice.productId))
          .map(item => `${item.resolvedAssetId}:${item.assetPrice.productId}`)
      )).map((key) => {
        const [assetId, productId] = key.split(':')
        return { assetId, productId }
      }).filter(item => item.assetId && item.productId)

      const activeOffers = offerConditions.length
        ? await tx.assetProductOffer.findMany({
            where: {
              tenantId: branchCtx.tenantId,
              active: true,
              OR: offerConditions,
              AND: [
                { effectiveFrom: { lte: now } },
                { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }
              ]
            },
            select: {
              id: true,
              assetId: true,
              productId: true,
              pricingType: true,
              amount: true,
              durationMinutes: true,
              serviceMode: true,
              serviceUnit: true,
              quantity: true,
              priority: true
            },
            orderBy: [{ priority: 'asc' }, { effectiveFrom: 'desc' }]
          })
        : []
      const offerByAssetProduct = new Map<string, (typeof activeOffers)[number]>()
      for (const item of activeOffers) {
        const key = `${item.assetId}:${item.productId}`
        const existing = offerByAssetProduct.get(key)
        if (!existing) {
          offerByAssetProduct.set(key, item)
          continue
        }
        const priorityDiff = item.priority - existing.priority
        if (priorityDiff < 0 || (priorityDiff === 0 && pricingTypeRank(item.pricingType) < pricingTypeRank(existing.pricingType))) {
          offerByAssetProduct.set(key, item)
        }
      }

      const totalAmount = resolvedItemPairs.reduce((sum, item) => {
        const key = item.assetPrice.productId ? `${item.resolvedAssetId}:${item.assetPrice.productId}` : ''
        const offer = key ? offerByAssetProduct.get(key) : null
        return sum + Number(offer?.amount ?? item.assetPrice.amount)
      }, 0)
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

      const reservedMachineIds = new Set<string>()
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
            create: resolvedItemPairs.map(({ machine, resolvedAssetId, assetPrice }) => {
              const offerKey = assetPrice.productId ? `${resolvedAssetId}:${assetPrice.productId}` : ''
              const offer = offerKey ? offerByAssetProduct.get(offerKey) : null

              const resolvedMachineId = machine?.id || assetToMachineMap.get(resolvedAssetId) || null
              if (!resolvedMachineId) {
                throw createError({ statusCode: 409, statusMessage: 'No available machine bound to selected asset' })
              }
              reservedMachineIds.add(resolvedMachineId)

              const candidates = machinePrices.filter(entry => entry.machineId === resolvedMachineId)
              const matchedMachinePrice =
                candidates.find(entry => entry.sortOrder === assetPrice.sortOrder) ||
                candidates.find(entry => entry.amount === assetPrice.amount && entry.durationMinutes === assetPrice.durationMinutes) ||
                candidates[0]

              if (!matchedMachinePrice) {
                throw createError({ statusCode: 400, statusMessage: 'Machine price mapping is not configured' })
              }

              return {
                machineId: resolvedMachineId,
                assetId: resolvedAssetId,
                productId: assetPrice.productId,
                priceId: matchedMachinePrice.id,
                priceLabel: assetPrice.product?.name || matchedMachinePrice.label,
                amount: offer?.amount ?? assetPrice.amount,
                durationMinutes: offer?.durationMinutes ?? assetPrice.durationMinutes,
                serviceModeSnapshot: offer?.serviceMode ?? assetPrice.serviceMode,
                unitSnapshot: offer?.serviceUnit ?? assetPrice.serviceUnit,
                quantitySnapshot: offer?.quantity ?? assetPrice.quantity
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
              paymentMethod: providerQr ? 'PROVIDER_QR' : 'INTERNAL_QR',
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
          id: { in: Array.from(reservedMachineIds) }
        },
        data: {
          status: MachineStatus.RESERVED,
          remainingMinutes: expiryMinutes
        }
      })

      const createdPayment = await tx.payment.findUnique({
        where: { orderId: order.id },
        select: { id: true, providerCode: true }
      })

      if (createdPayment) {
        await logPaymentTrace({
          paymentId: createdPayment.id,
          orderId: order.id,
          stage: 'QR_ISSUE',
          direction: 'OUTBOUND',
          providerCode: createdPayment.providerCode || null,
          statusCode: providerQr?.trace?.responseStatus || 200,
          requestHeaders: providerQr?.trace?.requestHeaders || null,
          requestBody: providerQr?.trace?.requestBody || null,
          responseBody: providerQr?.trace?.responseBody || { qrPayload },
          mappedStatus: providerQr ? 'PROVIDER_QR_ISSUED' : 'INTERNAL_QR_BUILT',
          note: providerQr ? `${providerQr.trace.method} ${providerQr.trace.endpoint}` : 'Built from internal PromptPay payload'
        })
      }

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
