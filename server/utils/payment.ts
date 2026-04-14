import PromptPay from 'promptpay-js'

type PromptPayGenerator = {
  generate?: (payload: Record<string, unknown>) => string
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeMobileNumber(value: string) {
  const digits = normalizeDigits(value)

  if (digits.startsWith('0066')) {
    return digits
  }

  if (digits.startsWith('66')) {
    return `00${digits}`
  }

  if (digits.startsWith('0')) {
    return `0066${digits.slice(1)}`
  }

  return digits
}

function fallbackPayload(target: string, amount: number, ref1?: string, ref2?: string) {
  return `MOCK-PAYLOAD|TARGET:${target}|AMOUNT:${amount.toFixed(2)}|REF1:${ref1 || '-'}|REF2:${ref2 || '-'}`
}

function crc16ccitt(str: string) {
  let crc = 0xffff

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8

    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function parseTlv(input: string) {
  const nodes: Array<{ tag: string, length: number, value: string }> = []
  let cursor = 0

  while (cursor + 4 <= input.length) {
    const tag = input.slice(cursor, cursor + 2)
    const length = Number(input.slice(cursor + 2, cursor + 4))
    const valueStart = cursor + 4
    const valueEnd = valueStart + length

    nodes.push({
      tag,
      length,
      value: input.slice(valueStart, valueEnd)
    })

    cursor = valueEnd
  }

  return nodes
}

function stringifyTlv(nodes: Array<{ tag: string, value: string }>) {
  return nodes.map(node => `${node.tag}${String(node.value.length).padStart(2, '0')}${node.value}`).join('')
}

function normalizeMaeManeeReference(value: string) {
  return value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 20)
}

function updateMaeManeeTemplatePayload(template: string, amount: number, reference: string) {
  const rootNodes = parseTlv(template)
  const crcIndex = rootNodes.findIndex(node => node.tag === '63')
  const workingRoot = crcIndex >= 0 ? rootNodes.slice(0, crcIndex) : rootNodes

  const tag30Index = workingRoot.findIndex(node => node.tag === '30')
  if (tag30Index >= 0) {
    const tag30Node = workingRoot[tag30Index]
    if (!tag30Node) {
      return template
    }

    const nested = parseTlv(tag30Node.value)
    const nested03Index = nested.findIndex(node => node.tag === '03')
    const safeReference = normalizeMaeManeeReference(reference) || 'ORDERREF'

    if (nested03Index >= 0) {
      const nested03 = nested[nested03Index]
      if (nested03) {
        nested[nested03Index] = { ...nested03, value: safeReference }
      }
    } else {
      nested.push({ tag: '03', length: safeReference.length, value: safeReference })
    }

    workingRoot[tag30Index] = {
      ...tag30Node,
      value: stringifyTlv(nested.map(node => ({ tag: node.tag, value: node.value })))
    }
  }

  const amountNodeIndex = workingRoot.findIndex(node => node.tag === '54')
  const amountValue = amount.toFixed(2)

  if (amountNodeIndex >= 0) {
    const amountNode = workingRoot[amountNodeIndex]
    if (!amountNode) {
      return template
    }

    workingRoot[amountNodeIndex] = {
      ...amountNode,
      value: amountValue
    }
  } else {
    workingRoot.push({ tag: '54', length: amountValue.length, value: amountValue })
  }

  const base = `${stringifyTlv(workingRoot.map(node => ({ tag: node.tag, value: node.value })))}6304`
  return `${base}${crc16ccitt(base)}`
}

type BuildPayloadInput = {
  mode?: string
  target: string
  amount: number
  orderNumber?: string
  lineUserId?: string | null
  billerId?: string
  referencePrefix?: string
  templatePayload?: string
}

export function buildPromptPayPayload(input: BuildPayloadInput) {
  const mode = input.mode || 'promptpay'

  if (mode === 'maemanee_template') {
    const template = input.templatePayload || ''
    const orderRef = normalizeMaeManeeReference(input.orderNumber || 'ORDTEST')

    if (!template) {
      return fallbackPayload(input.target, input.amount, orderRef)
    }

    return updateMaeManeeTemplatePayload(template, input.amount, orderRef)
  }

  const generator = (PromptPay as unknown as PromptPayGenerator).generate

  if (typeof generator !== 'function') {
    return fallbackPayload(input.target, input.amount, input.orderNumber, input.lineUserId || undefined)
  }

  try {
    if (mode === 'maemanee') {
      const billerId = normalizeDigits(input.billerId || '')
      const ref1 = `${input.referencePrefix || 'ORD'}-${(input.orderNumber || 'TEST').replace(/[^A-Z0-9-]/gi, '').slice(0, 20)}`
      const ref2 = normalizeDigits(input.target || '').slice(0, 20) || '01400003906609'

      if (!billerId) {
        return fallbackPayload(input.target, input.amount, ref1, ref2)
      }

      return generator({
        method: 'QR_DYNAMIC',
        application: 'PROMPTPAY_BILL_PAYMENT',
        billerID: billerId,
        reference1: ref1,
        reference2: ref2,
        amount: input.amount.toFixed(2),
        currencyCode: '764',
        countryCode: 'TH'
      })
    }

    if (!input.target) {
      return fallbackPayload('0812345678', input.amount, input.orderNumber, input.lineUserId || undefined)
    }

    const digits = normalizeDigits(input.target)
    const basePayload: Record<string, unknown> = {
      method: 'QR_STATIC',
      application: 'PROMPTPAY_CREDIT_TRANSFER',
      currencyCode: '764',
      countryCode: 'TH',
      amount: input.amount.toFixed(2)
    }

    if (digits.length <= 10) {
      basePayload.mobileNumber = normalizeMobileNumber(input.target)
    } else if (digits.length === 13) {
      basePayload.nationalID = digits
    } else {
      basePayload.eWalletID = digits
    }

    return generator(basePayload)
  } catch (error) {
    console.warn('PromptPay generator fallback to mock payload', error)
    return fallbackPayload(input.target, input.amount, input.orderNumber, input.lineUserId || undefined)
  }
}
