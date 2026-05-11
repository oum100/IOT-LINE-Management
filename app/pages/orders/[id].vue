<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import type { OrderDetails } from '~~/shared/types'

definePageMeta({
  layout: 'liff'
})

const route = useRoute()
const router = useRouter()
const orderId = computed(() => route.params.id as string)
const branchCode = computed(() => {
  const raw = route.query.branchCode
  return typeof raw === 'string' ? raw.trim() : ''
})
const branchQuery = computed(() => branchCode.value ? `branchCode=${encodeURIComponent(branchCode.value)}` : '')
const withBranchQuery = (url: string) => {
  if (!branchQuery.value) return url
  return `${url}${url.includes('?') ? '&' : '?'}${branchQuery.value}`
}
const tokenStorageKey = computed(() => `order-self-cancel-token:${orderId.value}`)
const slipFile = ref<File | null>(null)
const uploading = ref(false)
const verifying = ref(false)
const cancelling = ref(false)
const nowTs = ref(Date.now())
const storedSelfCancelToken = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null
const expiryRefreshTriggered = ref(false)

const { data: order, refresh } = await useFetch<OrderDetails>(() => withBranchQuery(`/api/orders/${orderId.value}`))
const querySelfCancelToken = computed(() => {
  const raw = route.query.ct
  return typeof raw === 'string' ? raw : ''
})
const selfCancelToken = computed(() => querySelfCancelToken.value || storedSelfCancelToken.value)

const isServiceStarted = computed(() => ['IN_PROGRESS', 'COMPLETED'].includes(order.value?.status || ''))
const receiptNumber = computed(() => `RCPT-${order.value?.orderNumber || 'TEST'}`)
const qrImageUrl = computed(() => withBranchQuery(`/api/orders/${orderId.value}/qr-jpg`))
const qrImageSaveUrl = computed(() => withBranchQuery(`/api/orders/${orderId.value}/qr-jpg?download=1`))
const receiptImageSaveUrl = computed(() => withBranchQuery(`/api/orders/${orderId.value}/receipt-line-jpg?download=1`))
const qrIncludesOrderReference = computed(() => {
  const payload = order.value?.payment?.qrPayload || ''
  const orderNumber = order.value?.orderNumber || ''

  return Boolean(payload && orderNumber && payload.includes(orderNumber))
})
const slipVerificationTone = computed(() => {
  const status = order.value?.payment.status

  if (status === 'VERIFIED') {
    return 'success'
  }

  if (status === 'REJECTED') {
    return 'error'
  }

  if (status === 'SLIP_UPLOADED') {
    return 'warning'
  }

  return 'neutral'
})
const paymentStatusMap: Record<string, string> = {
  PENDING: 'Wait for Pay',
  SLIP_UPLOADED: 'Waiting for Review',
  VERIFIED: 'Verified',
  REJECTED: 'Failed'
}

const slipStatusMap: Record<string, string> = {
  PENDING: 'Waiting for Upload',
  SLIP_UPLOADED: 'Waiting for Review',
  VERIFIED: 'Verified',
  REJECTED: 'Failed'
}

const paymentStatusLabel = computed(() => paymentStatusMap[order.value?.payment.status || ''] || order.value?.payment.status || '-')
const slipStatusLabel = computed(() => slipStatusMap[order.value?.payment.status || ''] || order.value?.payment.status || '-')
const isPaymentCountdownActive = computed(() => {
  const status = order.value?.payment.status
  return status === 'PENDING' || status === 'SLIP_UPLOADED'
})
const paymentSecondsLeft = computed(() => {
  if (!isPaymentCountdownActive.value) {
    return 0
  }

  const deadlineAt = order.value?.paymentDeadlineAt
  return deadlineAt ? Math.max(0, Math.floor((new Date(deadlineAt).getTime() - nowTs.value) / 1000)) : 0
})
const canUploadSlip = computed(() => {
  if (!order.value) {
    return false
  }

  const blockedOrder = order.value.status === 'CANCELLED' || order.value.paymentExpired
  const blockedPayment = order.value.payment.status === 'VERIFIED' || order.value.payment.status === 'REJECTED'

  return Boolean(slipFile.value) && !uploading.value && !blockedOrder && !blockedPayment
})
const paymentStatusColor = computed(() => {
  const status = order.value?.payment.status

  if (status === 'VERIFIED') {
    return 'success'
  }

  if (status === 'REJECTED') {
    return 'error'
  }

  return 'warning'
})
const paymentStatusTextClass = computed(() => {
  const status = order.value?.payment.status

  if (status === 'PENDING') {
    return 'animate-pulse text-red-600'
  }

  return ''
})
const canCancelOrder = computed(() => {
  const deadlineAt = order.value?.paymentDeadlineAt
  const hasTimeLeft = deadlineAt ? new Date(deadlineAt).getTime() > nowTs.value : false
  return Boolean(order.value?.canCancel) && hasTimeLeft && !cancelling.value && Boolean(selfCancelToken.value)
})
const showDemoAdminAction = computed(() => {
  if (!order.value) {
    return false
  }

  return order.value.status !== 'CANCELLED' && !order.value.paymentExpired && !isServiceStarted.value
})
const countdownIsUrgent = computed(() => isPaymentCountdownActive.value && paymentSecondsLeft.value > 0 && paymentSecondsLeft.value <= 120)
const paymentCountdownText = computed(() => {
  if (!isPaymentCountdownActive.value) {
    return 'ชำระเรียบร้อยแล้ว'
  }

  const seconds = paymentSecondsLeft.value

  if (seconds <= 0) {
    return 'หมดเวลาชำระแล้ว'
  }

  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  return `เวลาชำระคงเหลือ ${minutes}:${String(remainSeconds).padStart(2, '0')} นาที`
})

async function saveQrImage() {
  const fileName = `${order.value?.orderNumber || 'order'}-qr.jpg`
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')

  if (isMobile) {
    window.open(qrImageSaveUrl.value, '_blank')
    return
  }

  try {
    const response = await fetch(qrImageSaveUrl.value)
    if (!response.ok) {
      throw new Error(`Failed to load QR image: ${response.status}`)
    }

    const blob = await response.blob()
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
    const canShareFiles =
      typeof navigator !== 'undefined' &&
      'share' in navigator &&
      'canShare' in navigator &&
      navigator.canShare?.({ files: [file] })

    if (canShareFiles) {
      await navigator.share({
        files: [file],
        title: 'QR Image'
      })
      return
    }

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
  } catch {
    window.open(qrImageSaveUrl.value, '_blank')
  }
}

async function saveReceiptImage() {
  const fileName = `${receiptNumber.value}.jpg`
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')

  if (isMobile) {
    window.open(receiptImageSaveUrl.value, '_blank')
    return
  }

  try {
    const response = await fetch(receiptImageSaveUrl.value)
    if (!response.ok) {
      throw new Error(`Failed to load receipt image: ${response.status}`)
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
  } catch {
    window.open(receiptImageSaveUrl.value, '_blank')
  }
}

async function goToMachineList() {
  const shouldAutoCancel =
    Boolean(order.value?.id) &&
    Boolean(selfCancelToken.value) &&
    Boolean(order.value?.canCancel) &&
    !isServiceStarted.value &&
    (order.value?.payment.status === 'PENDING' || order.value?.payment.status === 'SLIP_UPLOADED')

  if (shouldAutoCancel) {
    try {
      await $fetch(withBranchQuery(`/api/orders/${order.value!.id}/self-cancel`), {
        method: 'POST',
        body: {
          branchCode: branchCode.value || undefined,
          token: selfCancelToken.value,
          reason: 'Customer backed to machine list'
        }
      })
    } catch {
      // keep navigation behavior even if cancel API fails
    }
  }

  router.push(branchCode.value ? `/order?branchCode=${encodeURIComponent(branchCode.value)}` : '/order')
}

async function uploadSlip() {
  if (!slipFile.value) {
    return
  }

  const formData = new FormData()
  formData.append('slip', slipFile.value)

  uploading.value = true

  try {
    await $fetch(withBranchQuery(`/api/orders/${orderId.value}/slip`), {
      method: 'POST',
      body: formData
    })

    await refresh()
    await router.push(withBranchQuery(`/status/${order.value?.orderNumber || orderId.value}`))
  } finally {
    uploading.value = false
  }
}

async function demoApprove() {
  verifying.value = true

  try {
    await $fetch(withBranchQuery(`/api/orders/${orderId.value}/verify-slip`), {
      method: 'POST',
      body: {
        branchCode: branchCode.value || undefined,
        approved: true,
        reviewer: 'demo-admin'
      }
    })

    await refresh()
    await router.push(withBranchQuery(`/status/${order.value?.orderNumber || orderId.value}`))
  } finally {
    verifying.value = false
  }
}

async function cancelOrder() {
  if (!order.value?.id || !canCancelOrder.value) {
    return
  }

  cancelling.value = true

  try {
    await $fetch(withBranchQuery(`/api/orders/${order.value.id}/self-cancel`), {
      method: 'POST',
      body: {
        branchCode: branchCode.value || undefined,
        token: selfCancelToken.value,
        reason: 'Cancelled by customer before successful payment'
      }
    })
    await router.push(branchCode.value ? `/order?branchCode=${encodeURIComponent(branchCode.value)}` : '/order')
  } finally {
    cancelling.value = false
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    if (querySelfCancelToken.value) {
      storedSelfCancelToken.value = querySelfCancelToken.value
      window.sessionStorage.setItem(tokenStorageKey.value, querySelfCancelToken.value)
    } else {
      storedSelfCancelToken.value = window.sessionStorage.getItem(tokenStorageKey.value) || ''
    }
  }

  countdownTimer = setInterval(() => {
    nowTs.value = Date.now()

    if (!expiryRefreshTriggered.value && paymentSecondsLeft.value === 0 && order.value?.canCancel) {
      expiryRefreshTriggered.value = true
      refresh()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})

watch(querySelfCancelToken, (next) => {
  if (typeof window === 'undefined') return
  if (!next) return
  storedSelfCancelToken.value = next
  window.sessionStorage.setItem(tokenStorageKey.value, next)
})

watch(
  () => ({
    status: order.value?.status,
    paymentExpired: order.value?.paymentExpired,
    paymentStatus: order.value?.payment?.status
  }),
  (next) => {
    if (!next) {
      return
    }

    const shouldBackToList =
      (next.status === 'CANCELLED' || next.paymentExpired || next.paymentStatus === 'REJECTED') &&
      !isServiceStarted.value

    if (shouldBackToList) {
      setTimeout(() => {
        router.push(branchCode.value ? `/order?branchCode=${encodeURIComponent(branchCode.value)}` : '/order')
      }, 600)
    }
  },
  { deep: true }
)
</script>

<template>
  <div v-if="order" class="mx-auto grid w-full max-w-none items-start gap-5 px-4 py-4 text-slate-100 sm:grid-cols-[1fr_0.95fr] sm:px-6 sm:py-6 lg:px-8">
    <section class="space-y-5">
      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
          @click="goToMachineList"
        >
          Back to Machine List
        </button>
      </div>
      <OrderStatusPanel :order="order" />

      <div class="section-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.25em] text-teal-300">Payment</p>
            <h3 class="text-lg font-semibold text-slate-100">PromptPay QR</h3>
          </div>
          <UBadge
            :color="paymentStatusColor"
            variant="soft"
            class="px-3 py-1 text-lg font-semibold"
          >
            <span :class="paymentStatusTextClass">
              {{ paymentStatusLabel }}
            </span>
          </UBadge>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-[minmax(280px,360px)_1fr]">
          <div class="space-y-3">
            <img
              :src="qrImageUrl"
              alt="PromptPay QR"
              class="mx-auto block h-auto w-full max-w-[360px] rounded-3xl border border-slate-100 bg-white p-2 shadow-sm"
            >
            <button
              type="button"
              class="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 active:scale-[0.99]"
              @click="saveQrImage"
            >
              Save Image
            </button>
            <p class="text-center text-[11px] text-slate-300">มือถือจะเปิดรูป QR ให้บันทึก/แชร์ได้ทันที</p>
          </div>
          <div class="space-y-3">
            <div class="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3">
              <p class="text-sm text-slate-300">ยอดชำระ</p>
              <p class="text-3xl font-semibold text-teal-300">{{ order.payment.amount }} บาท</p>
            </div>
            <div class="rounded-2xl border border-amber-700/60 bg-amber-900/20 px-4 py-3 text-sm leading-6 text-amber-100">
              สแกน QR เพื่อชำระเงินก่อน เมื่อชำระแล้วให้ส่ง Slip กลับมาเพื่อยืนยันการชำระ
              หลังตรวจสอบสำเร็จ ระบบจึงจะเริ่มบริการและสั่งงานเครื่องตามออเดอร์
            </div>
            <div class="rounded-2xl border border-orange-700/60 bg-orange-900/20 px-4 py-3">
              <p class="text-sm font-semibold" :class="countdownIsUrgent ? 'animate-pulse text-red-300' : 'text-orange-300'">
                {{ paymentCountdownText }}
              </p>
              <p class="mt-1 text-xs text-orange-200">หมดเวลาแล้วระบบจะยกเลิกออเดอร์อัตโนมัติ</p>
              <button
                v-if="canCancelOrder"
                type="button"
                class="mt-3 w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!canCancelOrder"
                @click="cancelOrder"
              >
                {{ cancelling ? 'Cancelling...' : 'Cancel Order' }}
              </button>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-300">
              <p class="font-medium text-slate-100">QR Payload</p>
              <p class="mt-2 break-all">{{ order.payment.qrPayload }}</p>
              <p v-if="qrIncludesOrderReference" class="mt-3 text-xs font-medium text-teal-300">
                Order reference in QR: {{ order.orderNumber }}
              </p>
            </div>
            <p class="text-xs text-slate-300">ถ้าเปิดใน LIFF ให้แตะ Save Image แล้วกดบันทึกรูปจากหน้าที่เปิดใหม่</p>
          </div>
        </div>
      </div>

      <div v-if="isServiceStarted" class="section-card p-4">
        <p class="text-xs uppercase tracking-[0.25em] text-teal-300">Machine Status</p>
        <h3 class="mt-1 text-lg font-semibold text-slate-100">สถานะเครื่องทั้งหมดในออเดอร์</h3>
        <div class="mt-4 space-y-3">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-semibold text-slate-100">{{ item.machine.name }}</p>
                <p class="text-sm text-slate-300">{{ item.durationMinutes }} นาที • {{ item.priceLabel }}</p>
              </div>
              <UBadge :color="item.status === 'COMPLETED' ? 'success' : 'warning'" variant="soft" class="px-3 py-1 text-base font-semibold">
                {{ item.status === 'COMPLETED' ? 'Completed' : 'Running' }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isServiceStarted" class="section-card p-4">
        <p class="text-xs uppercase tracking-[0.25em] text-teal-300">Receipt</p>
        <div class="mt-1 flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-slate-100">ใบเสร็จ</h3>
        </div>
        <div class="mt-4 rounded-3xl border border-slate-700 bg-slate-800 px-4 py-4">
          <div class="space-y-2 border-b border-dashed border-slate-600 pb-3">
            <div>
              <p class="text-sm text-slate-300">Receipt No.</p>
              <p class="break-all font-semibold text-slate-100">{{ receiptNumber }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-300">Order</p>
              <p class="break-all font-semibold text-slate-100">{{ order.orderNumber }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-300">Customer</p>
              <p class="break-all font-semibold text-slate-100">{{ order.customerName }}</p>
            </div>
          </div>
          <div class="mt-3 space-y-2">
            <div
              v-for="item in order.items"
              :key="item.id"
              class="flex items-center justify-between gap-3 text-sm"
            >
              <span class="text-slate-200">{{ item.machine.name }} • {{ item.durationMinutes }} นาที</span>
              <span class="font-medium text-slate-100">{{ item.amount }} บาท</span>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between border-t border-dashed border-slate-600 pt-3">
            <span class="text-sm text-slate-300">ยอดรวม</span>
            <span class="text-xl font-semibold text-teal-300">{{ order.totalAmount }} บาท</span>
          </div>
          <button
            type="button"
            class="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 active:scale-[0.99]"
            @click="saveReceiptImage"
          >
            Save Receipt
          </button>
          <p class="mt-2 text-center text-[11px] text-slate-300">มือถือจะเปิดรูปใบเสร็จให้บันทึก/แชร์ได้ทันที</p>
        </div>
      </div>
    </section>

    <section class="space-y-5">
      <div class="section-card p-4">
        <p class="text-xs uppercase tracking-[0.25em] text-orange-500">Slip Review</p>
        <h3 class="mt-1 text-lg font-semibold text-slate-100">อัปโหลดสลิปเพื่อรอตรวจสอบ</h3>
        <p class="mt-2 text-sm leading-6 text-slate-300">
          ขั้นตอนนี้จำเป็นก่อนเริ่มบริการ กรุณาส่ง Slip หลังโอนเงิน เพื่อให้ระบบหรือแอดมินยืนยันแล้วค่อยเริ่มเดินเครื่อง
        </p>

        <UAlert
          class="mt-4"
          :color="slipVerificationTone"
          variant="soft"
          :title="`Slip status: ${slipStatusLabel}`"
          :description="order.payment.rejectedNote || 'Use this Slip status as the main status for payment progress.'"
        />

        <div class="mt-4 space-y-4">
          <input
            type="file"
            accept="image/*,.pdf"
            class="block w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100"
            @change="event => slipFile = (event.target as HTMLInputElement).files?.[0] || null"
          >
          <button
            type="button"
            class="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!canUploadSlip"
            @click="uploadSlip"
          >
            {{ uploading ? 'Uploading...' : 'Upload Slip' }}
          </button>
        </div>
      </div>

      <div v-if="showDemoAdminAction" class="section-card p-4">
        <p class="text-xs uppercase tracking-[0.25em] text-orange-500">Demo Admin Action</p>
        <h3 class="mt-1 text-lg font-semibold text-slate-100">จำลอง approve slip แล้วสั่งงานเครื่อง</h3>
        <p class="mt-2 text-sm leading-6 text-slate-300">
          ปุ่มนี้ใช้เฉพาะทดสอบกรณีอยาก bypass การตรวจจริงเท่านั้น เส้นทางหลักของระบบคืออัปโหลด slip แล้วให้ Slip2Go ยืนยันก่อนเริ่มบริการ
        </p>
        <UButton block size="xl" class="mt-4" color="secondary" :loading="verifying" @click="demoApprove">
          Approve Slip And Start Machines
        </UButton>
      </div>
    </section>
  </div>
</template>
