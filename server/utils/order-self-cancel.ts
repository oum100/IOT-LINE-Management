import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function generateOrderSelfCancelToken() {
  return randomBytes(24).toString('base64url')
}

export function hashOrderSelfCancelToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyOrderSelfCancelToken(rawToken: string, tokenHash: string) {
  const incoming = Buffer.from(hashOrderSelfCancelToken(rawToken), 'hex')
  const expected = Buffer.from(String(tokenHash || ''), 'hex')
  if (incoming.length !== expected.length) return false
  return timingSafeEqual(incoming, expected)
}
