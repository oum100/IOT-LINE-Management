<script setup lang="ts">
import { buildPromptPayPayload } from '~~/server/utils/payment'

const realOrderNumber = 'ORD-8H2K4M9Q'
const payload = buildPromptPayPayload({
  mode: 'maemanee_template',
  target: '01400003906609',
  amount: 1,
  orderNumber: realOrderNumber,
  templatePayload: '00020101021230690016A000000677010112011501075360001028602150140000039066090307ABCDEFG5802TH540510.00530376462200716000000000059135263046988'
})
const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(payload)}`

function copyPayload() {
  navigator.clipboard.writeText(payload)
}
</script>

<template>
  <div class="mx-auto max-w-xl p-6">
    <div class="section-card p-6 text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.25em] text-orange-500">Mae Manee Test</p>
      <h1 class="mt-2 text-2xl font-semibold text-slate-900">QR ทดลอง 1 บาท</h1>
      <p class="mt-2 text-sm text-slate-600">โหมด bill payment พร้อม reference สำหรับลองสแกน/ลองเช็ก payload</p>

      <img
        :src="qrImage"
        alt="Mae Manee test QR"
        class="mx-auto mt-6 h-80 w-80 rounded-3xl border border-slate-100 bg-white p-4"
      >

      <div class="mt-6 rounded-2xl bg-slate-50 p-4 text-left">
        <p class="text-sm font-medium text-slate-900">Payload</p>
        <p class="mt-2 break-all text-xs leading-6 text-slate-600">{{ payload }}</p>
        <p class="mt-3 text-xs text-slate-500">merchant code: 01400003906609 • order ref: {{ realOrderNumber }} • amount: 1.00</p>
      </div>

      <div class="mt-4 flex gap-3">
        <UButton block color="primary" @click="copyPayload">
          Copy Payload
        </UButton>
        <UButton block color="neutral" variant="soft" :to="qrImage" target="_blank">
          Open QR Image
        </UButton>
      </div>
    </div>
  </div>
</template>
