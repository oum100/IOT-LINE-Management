export type MachineWithPrices = {
  id: string
  code: string
  name: string
  kind: 'WASHER' | 'DRYER'
  status: 'AVAILABLE' | 'RESERVED' | 'RUNNING' | 'MAINTENANCE'
  assetStatus?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  locationLabel: string
  remainingMinutes?: number | null
  prices: Array<{
    id: string
    machinePriceId?: string
    label: string
    amount: number
    durationMinutes: number
    serviceMode?: 'TIME' | 'QUANTITY' | 'UNIT'
    serviceUnit?: 'MINUTE' | 'SECOND' | 'LITER' | 'GRAM' | 'PIECE' | 'BOX' | 'SLOT'
    quantity?: number | null
  }>
}

export type OrderDetails = {
  id: string
  orderNumber: string
  customerName: string
  lineUserId: string | null
  totalAmount: number
  status: string
  note: string | null
  createdAt?: string
  paymentExpiryMinutes?: number
  paymentDeadlineAt?: string
  paymentSecondsLeft?: number
  paymentExpired?: boolean
  canCancel?: boolean
  items: Array<{
    id: string
    priceLabel: string
    amount: number
    durationMinutes: number
    status: string
    machine: {
      id: string
      name: string
      kind: string
    }
  }>
  payment: {
    id: string
    amount: number
    status: string
    qrPayload: string
    rejectedNote?: string | null
    slips: Array<{
      id: string
      fileName: string
      filePath: string
      uploadedAt: string
    }>
  }
}

export type OrderStatusView = {
  id: string
  orderNumber: string
  customerName: string
  orderStatus: string
  paymentStatus: string
  totalAmount: number
  updatedAt: string
  items: Array<{
    id: string
    machineName: string
    durationMinutes: number
    amount: number
    status: string
    startedAt?: string | null
    remainingMinutes?: number | null
  }>
}
