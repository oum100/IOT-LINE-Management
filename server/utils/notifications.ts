import { Resend } from 'resend'

type NotifyInput = {
  lineUserId?: string | null
  customerName: string
  message: string
}

type OrderReceiptNotifyInput = {
  lineUserId?: string | null
  customerName: string
  orderId: string
  orderNumber: string
  totalAmount: number
  receiptNumber?: string
  items: Array<{
    machineName: string
    durationMinutes: number
    amount: number
  }>
}

type LineMessage = {
  type: string
  [key: string]: unknown
}

function toAbsoluteUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

async function sendLinePushMessages(lineUserId: string, messages: LineMessage[], accessToken: string) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: lineUserId,
      messages
    })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`LINE push failed: ${response.status} ${detail}`)
  }
}

export async function sendCustomerNotification(input: NotifyInput) {
  const config = useRuntimeConfig()

  if (input.lineUserId && config.lineChannelAccessToken) {
    try {
      await sendLinePushMessages(
        input.lineUserId,
        [
          {
            type: 'text',
            text: input.message
          }
        ],
        config.lineChannelAccessToken
      )
      console.info('LINE push sent', {
        userId: input.lineUserId,
        customerName: input.customerName
      })
      return
    } catch (error) {
      console.error('LINE push failed', error)
    }
  }

  if (config.resendApiKey) {
    const resend = new Resend(config.resendApiKey)

    try {
      await resend.emails.send({
        from: 'Laundry IoT <no-reply@example.com>',
        to: ['ops@example.com'],
        subject: `LINE notification fallback for ${input.customerName}`,
        text: `${input.lineUserId || 'unknown-line-user'}: ${input.message}`
      })
    } catch (error) {
      console.error('resend notify failed', error)
    }
  }

  console.info('notification fallback', input)
}

export async function sendOrderReceiptCardNotification(input: OrderReceiptNotifyInput) {
  const config = useRuntimeConfig()
  const publicBaseUrl = config.public.appUrl || ''
  const receiptNumber = input.receiptNumber || `RCPT-${input.orderNumber}`

  if (!input.lineUserId || !config.lineChannelAccessToken || !publicBaseUrl) {
    await sendCustomerNotification({
      lineUserId: input.lineUserId,
      customerName: input.customerName,
      message: `Receipt ${receiptNumber}\nOrder ${input.orderNumber}\nTotal ${input.totalAmount} บาท`
    })
    return
  }

  const orderUrl = toAbsoluteUrl(publicBaseUrl, `/status/${encodeURIComponent(input.orderNumber)}`)
  const receiptJpgUrl = toAbsoluteUrl(publicBaseUrl, `/api/orders/${input.orderId}/receipt-line-jpg`)

  const messages: LineMessage[] = [
    {
      type: 'image',
      originalContentUrl: receiptJpgUrl,
      previewImageUrl: receiptJpgUrl
    },
    {
      type: 'flex',
      altText: `สถานะเครื่อง ${input.orderNumber}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: `Order ${input.orderNumber}`,
              size: 'lg',
              weight: 'bold',
              color: '#0f172a',
              wrap: true
            },
            {
              type: 'text',
              text: `ลูกค้า ${input.customerName || 'คุณลูกค้า'}`,
              size: 'sm',
              color: '#475569',
              wrap: true
            },
            {
              type: 'text',
              text: 'ตรวจสอบสถานะเครื่องล่าสุดได้ที่ปุ่มด้านล่าง',
              size: 'sm',
              color: '#334155',
              wrap: true
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#0284c7',
              action: {
                type: 'uri',
                label: 'ดูสถานะเครื่อง',
                uri: orderUrl
              }
            }
          ]
        }
      }
    }
  ]

  try {
    await sendLinePushMessages(input.lineUserId, messages, config.lineChannelAccessToken)
  } catch (error) {
    console.error('LINE receipt card push failed', error)
    await sendCustomerNotification({
      lineUserId: input.lineUserId,
      customerName: input.customerName,
      message: `Receipt ${receiptNumber}\nOrder ${input.orderNumber}\nTotal ${input.totalAmount} บาท`
    })
  }
}
