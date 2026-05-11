import { createError } from 'h3'

type IssueProviderQrInput = {
  baseUrl: string
  appKey?: string | null
  appSecret?: string | null
  credentials?: Record<string, unknown> | null
  orderNumber: string
  amount: number
  customerName?: string | null
  tenantId?: string | null
  merchantAccountId?: string | null
  branchId?: string | null
  callbackUrl?: string | null
}

type ProviderQrResult = {
  qrPayload: string
  providerPaymentIntentId: string | null
  providerReference: string | null
  trace: {
    endpoint: string
    method: string
    requestHeaders: Record<string, string>
    requestBody: Record<string, unknown> | null
    responseStatus: number
    responseBody: unknown
  }
}

function readCredentialString(credentials: Record<string, unknown> | null | undefined, key: string) {
  if (!credentials) return null
  const value = credentials[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readCredentialObject(credentials: Record<string, unknown> | null | undefined, key: string) {
  if (!credentials) return null
  const value = credentials[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function replaceTokens(value: string, context: Record<string, string>) {
  return value.replace(/\{\{(\w+)\}\}/g, (_, token: string) => context[token] || '')
}

function deepReplaceTokens(input: unknown, context: Record<string, string>): unknown {
  if (typeof input === 'string') {
    return replaceTokens(input, context)
  }
  if (Array.isArray(input)) {
    return input.map((item) => deepReplaceTokens(item, context))
  }
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, val]) => [key, deepReplaceTokens(val, context)])
    )
  }
  return input
}

export async function issueProviderQr(input: IssueProviderQrInput): Promise<ProviderQrResult> {
  const baseUrl = String(input.baseUrl || '').trim()
  if (!baseUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Provider baseUrl is required for Provider QR mode' })
  }

  const requestConfig = readCredentialObject(input.credentials || null, 'requestConfig')
  const responseConfig = readCredentialObject(input.credentials || null, 'responseConfig')
  const token = readCredentialString(input.credentials || null, 'token')
  const authHeader = input.appSecret || token
  const issuePath = readCredentialString(requestConfig || null, 'issuePath') || readCredentialString(input.credentials || null, 'issuePath') || '/qr/issue'
  const issueMethod = (readCredentialString(requestConfig || null, 'method') || 'POST').toUpperCase()
  const endpoint = `${baseUrl.replace(/\/+$/, '')}${issuePath.startsWith('/') ? issuePath : `/${issuePath}`}`
  const extraHeaders = readCredentialObject(requestConfig || null, 'extraHeaders') || readCredentialObject(input.credentials || null, 'extraHeaders')
  const bodyTemplate = readCredentialObject(requestConfig || null, 'payloadTemplate') || readCredentialObject(input.credentials || null, 'issuePayloadTemplate')
  const authConfig = readCredentialObject(input.credentials || null, 'auth')
  const authType = readCredentialString(requestConfig || null, 'authType') || readCredentialString(authConfig || null, 'type') || 'bearer'
  const apiKeyHeaderName = readCredentialString(requestConfig || null, 'apiKeyHeader') || readCredentialString(input.credentials || null, 'apiKeyHeader') || 'x-api-key'

  const tokenContext = {
    orderNumber: input.orderNumber,
    amount: String(input.amount),
    customerName: input.customerName || '',
    tenantId: input.tenantId || '',
    merchantAccountId: input.merchantAccountId || '',
    branchId: input.branchId || '',
    callbackUrl: input.callbackUrl || ''
  }

  const defaultBody = {
    orderNumber: input.orderNumber,
    amount: input.amount,
    customerName: input.customerName || null,
    tenantId: input.tenantId || null,
    merchantAccountId: input.merchantAccountId || null,
    branchId: input.branchId || null,
    callbackUrl: input.callbackUrl || null
  }
  const requestBody = (bodyTemplate
    ? deepReplaceTokens(bodyTemplate, tokenContext)
    : defaultBody) as Record<string, unknown>

  const headers: Record<string, string> = {
    'content-type': 'application/json'
  }

  if (input.appKey) headers[apiKeyHeaderName] = input.appKey
  if (authType === 'basic' && input.appKey && authHeader) {
    headers.authorization = `Basic ${Buffer.from(`${input.appKey}:${authHeader}`).toString('base64')}`
  } else if (authType !== 'none' && authHeader) {
    headers.authorization = `Bearer ${authHeader}`
  }
  if (extraHeaders) {
    for (const [key, val] of Object.entries(extraHeaders)) {
      if (typeof val === 'string' && val.trim()) {
        headers[key] = replaceTokens(val, tokenContext)
      }
    }
  }

  const traceRequestHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, val]) => {
      if (key.toLowerCase() === 'authorization') return [key, val ? '***' : '']
      return [key, val]
    })
  )

  const response = await fetch(endpoint, {
    method: issueMethod === 'GET' ? 'GET' : 'POST',
    headers,
    body: issueMethod === 'GET' ? undefined : JSON.stringify(requestBody)
  })

  let json: any = null
  try {
    json = await response.json()
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Provider returned unreadable response' })
  }

  if (!response.ok) {
    const message =
      (typeof json?.message === 'string' && json.message) ||
      (typeof json?.error === 'string' && json.error) ||
      `Provider QR issue failed (${response.status})`
    throw createError({ statusCode: 502, statusMessage: message })
  }

  const data = json?.data && typeof json.data === 'object' ? json.data : json
  const qrPayloadPath = readCredentialString(responseConfig || null, 'qrPayloadPath')
  const paymentIntentPath = readCredentialString(responseConfig || null, 'providerPaymentIntentIdPath')
  const referencePath = readCredentialString(responseConfig || null, 'providerReferencePath')
  const fromPath = (path?: string | null) => {
    if (!path) return null
    const keys = path.split('.').map((item) => item.trim()).filter(Boolean)
    let cursor: any = json
    for (const key of keys) {
      if (!cursor || typeof cursor !== 'object') return null
      cursor = cursor[key]
    }
    return cursor
  }
  const qrPayload = typeof fromPath(qrPayloadPath) === 'string'
    ? String(fromPath(qrPayloadPath))
    : (typeof data?.qrPayload === 'string' ? data.qrPayload : typeof data?.qr === 'string' ? data.qr : '')
  if (!qrPayload) {
    throw createError({ statusCode: 502, statusMessage: 'Provider response missing qrPayload' })
  }

  const providerPaymentIntentId =
    (typeof fromPath(paymentIntentPath) === 'string' && String(fromPath(paymentIntentPath))) ||
    (typeof data?.providerPaymentIntentId === 'string' && data.providerPaymentIntentId) ||
    (typeof data?.paymentIntentId === 'string' && data.paymentIntentId) ||
    null
  const providerReference =
    (typeof fromPath(referencePath) === 'string' && String(fromPath(referencePath))) ||
    (typeof data?.providerReference === 'string' && data.providerReference) ||
    (typeof data?.reference === 'string' && data.reference) ||
    null

  return {
    qrPayload,
    providerPaymentIntentId,
    providerReference,
    trace: {
      endpoint,
      method: issueMethod,
      requestHeaders: traceRequestHeaders,
      requestBody: issueMethod === 'GET' ? null : requestBody,
      responseStatus: response.status,
      responseBody: json
    }
  }
}
