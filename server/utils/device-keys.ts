import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { prisma } from './prisma'

export function generateRegistrationCode() {
  return `REG-${randomBytes(6).toString('hex').toUpperCase()}`
}

export function generateDeviceApiKey() {
  const prefix = `dvk_${randomBytes(4).toString('hex')}`
  const secret = randomBytes(24).toString('base64url')
  return {
    key: `${prefix}.${secret}`,
    keyPrefix: prefix,
    secretHash: sha256(secret)
  }
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function assertDeviceKey(key: string | undefined | null) {
  const raw = String(key || '')
  const [prefix, secret] = raw.split('.')
  if (!prefix || !secret) return null

  const record = await prisma.deviceApiKey.findUnique({
    where: { keyPrefix: prefix },
    include: {
      iotDevice: {
        include: {
          bindings: {
            where: { status: 'ACTIVE', endedAt: null },
            include: { asset: true }
          }
        }
      }
    }
  })
  if (!record || record.status !== 'ACTIVE') return null
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null
  if (record.revokedAt) return null

  const got = Buffer.from(sha256(secret), 'hex')
  const expected = Buffer.from(record.secretHash, 'hex')
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null

  await prisma.deviceApiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() }
  })

  return record
}
