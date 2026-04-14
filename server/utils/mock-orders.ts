import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { nanoid } from 'nanoid'
import type { MachineWithPrices, OrderDetails } from '~~/shared/types'

type MockOrderRecord = OrderDetails & {
  createdAt: string
  updatedAt: string
}

type MockOrderStore = {
  orders: MockOrderRecord[]
}

const STORE_PATH = join(process.cwd(), '.data', 'mock-orders.json')

async function ensureStore() {
  await mkdir(join(process.cwd(), '.data'), { recursive: true })
}

async function readStore(): Promise<MockOrderStore> {
  await ensureStore()

  try {
    const raw = await readFile(STORE_PATH, 'utf8')
    return JSON.parse(raw) as MockOrderStore
  } catch {
    return { orders: [] }
  }
}

async function writeStore(store: MockOrderStore) {
  await ensureStore()
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
}

export async function createMockOrder(input: {
  customerName: string
  lineUserId?: string | null
  note?: string | null
  paymentExpiryMinutes?: number
  selections: Array<{
    machine: MachineWithPrices
    priceId: string
  }>
  qrPayload: string
}) {
  const now = new Date().toISOString()
  const orderId = `mock_${nanoid(12)}`
  const orderNumber = `TEST-${nanoid(8).toUpperCase()}`
  const items = input.selections.flatMap((selection) => {
    const price = selection.machine.prices.find(entry => entry.id === selection.priceId)

    if (!price) {
      return []
    }

    return [{
      id: nanoid(10),
      priceLabel: price.label,
      amount: price.amount,
      durationMinutes: price.durationMinutes,
      status: 'PENDING',
      machine: {
        id: selection.machine.id,
        name: selection.machine.name,
        kind: selection.machine.kind
      }
    }]
  })

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
  const expiryMinutes = Number(input.paymentExpiryMinutes || 15)
  const paymentDeadlineAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString()

  const order: MockOrderRecord = {
    id: orderId,
    orderNumber,
    customerName: input.customerName,
    lineUserId: input.lineUserId || null,
    totalAmount,
    status: 'PENDING_PAYMENT',
    note: input.note || null,
    paymentExpiryMinutes: expiryMinutes,
    paymentDeadlineAt,
    paymentSecondsLeft: expiryMinutes * 60,
    paymentExpired: false,
    canCancel: true,
    items,
    payment: {
      id: `pay_${nanoid(10)}`,
      amount: totalAmount,
      status: 'PENDING',
      qrPayload: input.qrPayload,
      rejectedNote: null,
      slips: []
    },
    createdAt: now,
    updatedAt: now
  }

  const store = await readStore()
  store.orders.unshift(order)
  await writeStore(store)

  return order
}

export async function getMockOrder(orderId: string) {
  const store = await readStore()
  return store.orders.find(order => order.id === orderId) || null
}

export async function getMockOrderByOrderNumber(orderNumber: string) {
  const store = await readStore()
  return store.orders.find(order => order.orderNumber === orderNumber) || null
}

export async function updateMockOrder(
  orderId: string,
  updater: (order: MockOrderRecord) => MockOrderRecord
) {
  const store = await readStore()
  const index = store.orders.findIndex(order => order.id === orderId)

  if (index === -1) {
    return null
  }

  const current = store.orders[index]
  if (!current) {
    return null
  }

  store.orders[index] = updater(current)
  if (!store.orders[index]) {
    return null
  }
  store.orders[index].updatedAt = new Date().toISOString()
  await writeStore(store)

  return store.orders[index] || null
}
