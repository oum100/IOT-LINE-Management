import { createError } from 'h3'
import { getMockOrder } from './mock-orders'
import { prisma } from './prisma'

type AssetOrderItem = {
  id: string
  amount: number
  durationMinutes: number
  machine: {
    name: string
  }
}

export type OrderAssetPayload = {
  id: string
  orderNumber: string
  customerName: string
  totalAmount: number
  createdAt?: string
  paymentQrPayload: string
  items: AssetOrderItem[]
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function fallbackQrSvg(payload: string) {
  const seed = (payload || 'MOCK-QR').slice(0, 24)
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280">
  <rect width="280" height="280" rx="28" fill="#ffffff"/>
  <rect x="18" y="18" width="244" height="244" rx="24" fill="#111111"/>
  <g fill="#ffffff">
    <rect x="34" y="34" width="42" height="42" rx="8"/>
    <rect x="204" y="34" width="42" height="42" rx="8"/>
    <rect x="34" y="204" width="42" height="42" rx="8"/>
    <rect x="96" y="34" width="14" height="14"/>
    <rect x="124" y="34" width="14" height="14"/>
    <rect x="152" y="34" width="14" height="14"/>
    <rect x="96" y="62" width="14" height="14"/>
    <rect x="124" y="62" width="14" height="14"/>
    <rect x="152" y="62" width="14" height="14"/>
    <rect x="96" y="96" width="14" height="14"/>
    <rect x="124" y="96" width="14" height="14"/>
    <rect x="152" y="96" width="14" height="14"/>
    <rect x="180" y="96" width="14" height="14"/>
    <rect x="208" y="96" width="14" height="14"/>
    <rect x="68" y="124" width="14" height="14"/>
    <rect x="96" y="124" width="14" height="14"/>
    <rect x="152" y="124" width="14" height="14"/>
    <rect x="180" y="124" width="14" height="14"/>
    <rect x="208" y="124" width="14" height="14"/>
    <rect x="68" y="152" width="14" height="14"/>
    <rect x="96" y="152" width="14" height="14"/>
    <rect x="124" y="152" width="14" height="14"/>
    <rect x="180" y="152" width="14" height="14"/>
    <rect x="208" y="152" width="14" height="14"/>
    <rect x="96" y="180" width="14" height="14"/>
    <rect x="124" y="180" width="14" height="14"/>
    <rect x="152" y="180" width="14" height="14"/>
    <rect x="180" y="180" width="14" height="14"/>
    <rect x="208" y="180" width="14" height="14"/>
    <rect x="96" y="208" width="14" height="14"/>
    <rect x="124" y="208" width="14" height="14"/>
    <rect x="152" y="208" width="14" height="14"/>
  </g>
  <rect x="26" y="224" width="228" height="28" rx="12" fill="rgba(255,255,255,0.92)"/>
  <text x="140" y="243" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#334155">MOCK QR • ${escapeXml(seed)}</text>
</svg>
`.trim()
}

export async function findOrderAssetPayload(orderId: string): Promise<OrderAssetPayload> {
  try {
    const dbOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            machine: true
          }
        },
        payment: true
      }
    })

    if (dbOrder?.payment) {
      return {
        id: dbOrder.id,
        orderNumber: dbOrder.orderNumber,
        customerName: dbOrder.customerName,
        totalAmount: dbOrder.totalAmount,
        createdAt: dbOrder.createdAt.toISOString(),
        paymentQrPayload: dbOrder.payment.qrPayload,
        items: dbOrder.items.map(item => ({
          id: item.id,
          amount: item.amount,
          durationMinutes: item.durationMinutes,
          machine: {
            name: item.machine.name
          }
        }))
      }
    }
  } catch {
    // fallback to mock store
  }

  const mockOrder = await getMockOrder(orderId)

  if (!mockOrder) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  return {
    id: mockOrder.id,
    orderNumber: mockOrder.orderNumber,
    customerName: mockOrder.customerName,
    totalAmount: mockOrder.totalAmount,
    createdAt: mockOrder.createdAt,
    paymentQrPayload: mockOrder.payment.qrPayload,
    items: mockOrder.items.map(item => ({
      id: item.id,
      amount: item.amount,
      durationMinutes: item.durationMinutes,
      machine: {
        name: item.machine.name
      }
    }))
  }
}

export function buildReceiptSvg(order: OrderAssetPayload) {
  const receiptNumber = `RCPT-${order.orderNumber || 'TEST'}`
  const receiptAt = new Date(order.createdAt || Date.now()).toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  const rows = order.items.map((item, index) => `
    <rect x="46" y="${286 + index * 54}" width="988" height="42" rx="14" fill="#f8fafc"/>
    <text x="62" y="${313 + index * 54}" font-family="Arial, sans-serif" font-size="22" fill="#0f172a">${escapeXml(item.machine.name)} • ${item.durationMinutes} นาที</text>
    <text x="1018" y="${313 + index * 54}" text-anchor="end" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#0f172a">${item.amount} บาท</text>
  `).join('')

  const totalY = 314 + order.items.length * 54
  const height = totalY + 170

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#f0fdfa"/>
      <stop offset="100%" stop-color="#fff7ed"/>
    </linearGradient>
    <linearGradient id="head" x1="0%" x2="100%" y1="0%" y2="0%">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="${height}" rx="56" fill="url(#bg)"/>
  <rect x="22" y="22" width="1036" height="${height - 44}" rx="46" fill="#ffffff" stroke="#dbeafe"/>
  <rect x="46" y="46" width="988" height="132" rx="30" fill="url(#head)"/>
  <text x="78" y="102" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">Laundry IoT Merchant</text>
  <text x="78" y="142" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff">ใบเสร็จรับเงิน</text>
  <text x="62" y="216" font-family="Arial, sans-serif" font-size="22" fill="#0f766e" font-weight="700">Receipt No. ${escapeXml(receiptNumber)}</text>
  <text x="62" y="246" font-family="Arial, sans-serif" font-size="21" fill="#475569">Order ${escapeXml(order.orderNumber)} • ${escapeXml(receiptAt)}</text>
  <text x="62" y="274" font-family="Arial, sans-serif" font-size="21" fill="#334155">ลูกค้า: ${escapeXml(order.customerName || 'คุณลูกค้า')}</text>
  ${rows}
  <line x1="62" y1="${totalY + 18}" x2="1018" y2="${totalY + 18}" stroke="#cbd5e1" stroke-dasharray="7 7"/>
  <text x="62" y="${totalY + 74}" font-family="Arial, sans-serif" font-size="28" fill="#475569">ยอดรวมสุทธิ</text>
  <text x="1018" y="${totalY + 74}" text-anchor="end" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#0f766e">${order.totalAmount} บาท</text>
</svg>
`.trim()
}

function formatThaiDateTime(input?: string) {
  return new Date(input || Date.now()).toLocaleString('th-TH', {
    year: '2-digit',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function buildLineReceiptSvg(order: OrderAssetPayload) {
  const receiptNumber = `RCPT-${order.orderNumber || 'TEST'}`
  const customerName = order.customerName || 'คุณลูกค้า'
  const paidAt = formatThaiDateTime(order.createdAt)
  const firstItems = order.items.slice(0, 5)
  const itemLines = firstItems.map((item, i) => `
    <text x="92" y="${560 + i * 70}" font-family="Arial, sans-serif" font-size="46" fill="#0f172a">${escapeXml(item.machine.name)} • ${item.durationMinutes} นาที</text>
    <text x="988" y="${560 + i * 70}" text-anchor="end" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#0f172a">${item.amount.toFixed(2)} บาท</text>
  `).join('')

  const overflow = order.items.length - firstItems.length

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1460" viewBox="0 0 1080 1460">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#dff7ff"/>
      <stop offset="100%" stop-color="#f8efe1"/>
    </linearGradient>
    <linearGradient id="header" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1460" fill="url(#bg)"/>
  <circle cx="1000" cy="170" r="140" fill="#bfdbfe" opacity="0.45"/>
  <circle cx="120" cy="1280" r="220" fill="#e0e7ff" opacity="0.35"/>

  <rect x="34" y="34" width="1012" height="1392" rx="42" fill="#ffffff" stroke="#dbeafe"/>
  <rect x="66" y="66" width="948" height="196" rx="28" fill="url(#header)"/>
  <text x="98" y="142" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#ffffff">WashPoint</text>
  <text x="98" y="216" font-family="Arial, sans-serif" font-size="78" font-weight="700" fill="#ffffff">ใบเสร็จรับเงิน</text>

  <text x="92" y="344" font-family="Arial, sans-serif" font-size="52" fill="#0f172a" font-weight="700">${escapeXml(receiptNumber)}</text>
  <text x="92" y="412" font-family="Arial, sans-serif" font-size="44" fill="#334155">Order ${escapeXml(order.orderNumber)}</text>
  <text x="92" y="474" font-family="Arial, sans-serif" font-size="44" fill="#334155">ลูกค้า ${escapeXml(customerName)}</text>
  <text x="988" y="344" text-anchor="end" font-family="Arial, sans-serif" font-size="34" fill="#475569">ชำระเมื่อ ${escapeXml(paidAt)}</text>

  <line x1="88" y1="520" x2="992" y2="520" stroke="#dbeafe"/>

  ${itemLines}
  ${overflow > 0 ? `<text x="92" y="950" font-family="Arial, sans-serif" font-size="40" fill="#64748b">+ อีก ${overflow} รายการ</text>` : ''}

  <line x1="88" y1="1040" x2="992" y2="1040" stroke="#cbd5e1" stroke-dasharray="10 10"/>
  <text x="92" y="1148" font-family="Arial, sans-serif" font-size="64" fill="#334155">ยอดรวมสุทธิ</text>
  <text x="988" y="1148" text-anchor="end" font-family="Arial, sans-serif" font-size="104" font-weight="700" fill="#0f766e">${order.totalAmount.toFixed(2)} บาท</text>

  <text x="92" y="1240" font-family="Arial, sans-serif" font-size="38" fill="#64748b">ใบเสร็จอิเล็กทรอนิกส์สำหรับลูกค้า</text>
</svg>
`.trim()
}

export async function renderQrPng(payload: string) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(payload)}`
  const response = await fetch(qrUrl)

  if (!response.ok) {
    throw new Error(`QR generation failed with status ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

export function buildQrFallbackSvg(payload: string) {
  return fallbackQrSvg(payload)
}

export async function renderReceiptJpeg(svg: string) {
  const sharp = (await import('sharp')).default
  return sharp(Buffer.from(svg))
    .resize(1200, 780, {
      fit: 'contain',
      background: '#ffffff'
    })
    .jpeg({
      quality: 92,
      chromaSubsampling: '4:4:4'
    })
    .toBuffer()
}

export async function renderLineReceiptJpeg(svg: string) {
  const sharp = (await import('sharp')).default
  return sharp(Buffer.from(svg))
    .jpeg({
      quality: 92,
      chromaSubsampling: '4:4:4'
    })
    .toBuffer()
}

export async function renderPromptPayCardJpeg(order: OrderAssetPayload) {
  const qrPng = await renderQrPng(order.paymentQrPayload)
  const qrDataUrl = `data:image/png;base64,${Buffer.from(qrPng).toString('base64')}`
  const amountText = order.totalAmount.toFixed(2)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1680" viewBox="0 0 1080 1680">
  <rect width="1080" height="1680" fill="#f8fafc"/>
  <text x="72" y="112" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#0b4a8b">PromptPay</text>

  <rect x="86" y="230" width="908" height="120" rx="10" fill="#0b4a8b"/>
  <text x="540" y="308" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff">THAI QR PAYMENT</text>

  <rect x="320" y="392" width="440" height="92" rx="8" fill="#ffffff" stroke="#0b4a8b" stroke-width="3"/>
  <text x="540" y="452" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#0b4a8b">PromptPay</text>

  <rect x="190" y="534" width="700" height="700" rx="24" fill="#ffffff" stroke="#d1d5db"/>
  <image href="${qrDataUrl}" x="240" y="584" width="600" height="600"/>

  <text x="110" y="1318" font-family="Arial, sans-serif" font-size="48" fill="#111827">หมายเลขอ้างอิง</text>
  <text x="970" y="1318" text-anchor="end" font-family="Arial, sans-serif" font-size="44" fill="#374151">${escapeXml(order.orderNumber)}</text>
  <line x1="90" y1="1360" x2="990" y2="1360" stroke="#d1d5db"/>

  <text x="110" y="1456" font-family="Arial, sans-serif" font-size="52" fill="#111827">จำนวนเงิน</text>
  <text x="970" y="1456" text-anchor="end" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#111827">${amountText} บาท</text>

</svg>
`.trim()

  const sharp = (await import('sharp')).default
  return sharp(Buffer.from(svg))
    .jpeg({
      quality: 92,
      chromaSubsampling: '4:4:4'
    })
    .toBuffer()
}
