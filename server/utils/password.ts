import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

const KEYLEN = 64

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string) {
  const [salt, keyHex] = hash.split(':')
  if (!salt || !keyHex) return false
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer
  const stored = Buffer.from(keyHex, 'hex')
  if (stored.length !== derived.length) return false
  return timingSafeEqual(stored, derived)
}
