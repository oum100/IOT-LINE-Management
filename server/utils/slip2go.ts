import { createError } from 'h3'

export async function verifySlipWithSlip2Go(input: {
  fileBuffer: Uint8Array
  fileName: string
  mimeType?: string
  amount: number
}) {
  const config = useRuntimeConfig()

  if (!config.slip2GoSecretKey) {
    return {
      ok: false,
      code: 'TEST_MODE',
      message: 'SLIP2GO_SECRET_KEY is not configured'
    }
  }

  const byteArray = input.fileBuffer instanceof Uint8Array ? input.fileBuffer : new Uint8Array(input.fileBuffer)
  const buffer = Buffer.from(byteArray)

  const blob = new Blob([buffer], {
    type: input.mimeType || 'image/png'
  })

  const requestSlip2Go = async (payloadObject: Record<string, unknown>) => {
    const form = new FormData()
    form.append('file', blob, input.fileName)
    form.append('payload', JSON.stringify(payloadObject))

    const response = await fetch(`${config.slip2GoBaseUrl}/verify-slip/qr-image/info`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.slip2GoSecretKey}`
      },
      body: form
    })

    let json: any = null

    try {
      json = await response.json()
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: 'Slip2Go returned an unreadable response'
      })
    }

    return {
      ok: response.ok && ['200000', '200200'].includes(json?.code),
      code: json?.code || String(response.status),
      message: json?.message || 'Unknown Slip2Go response',
      data: json?.data
    }
  }

  const primary = await requestSlip2Go({
    checkCondition: {
      checkDuplicate: true,
      checkAmount: {
        type: 'eq',
        amount: input.amount
      }
    }
  })

  if (primary.code === '400400') {
    const secondary = await requestSlip2Go({
      checkDuplicate: true,
      checkAmount: {
        type: 'eq',
        amount: input.amount
      }
    })

    if (secondary.code !== '400400') {
      return secondary
    }

    return requestSlip2Go({
      checkDuplicate: true,
      checkAmount: {
        type: 'eq',
        amount: String(input.amount)
      }
    })
  }

  return primary
}
