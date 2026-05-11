<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from '#app'
import { useRoute } from '#imports'
import { useCartStore } from '~~/stores/cart'
import { useLineLiff } from '~~/composables/useLineLiff'

const cart = useCartStore()
const router = useRouter()
const route = useRoute()
const { profile } = useLineLiff()
const pending = ref(false)
const branchCode = computed(() => String(route.query.branchCode || '').trim())
const form = reactive({
  customerName: 'คุณลูกค้า',
  lineUserId: '',
  note: ''
})

watch(
  () => profile.value,
  (next) => {
    if (next.displayName) {
      form.customerName = next.displayName
    }

    if (next.userId) {
      form.lineUserId = next.userId
    }
  },
  { immediate: true, deep: true }
)

async function submitOrder() {
  if (!cart.items.length) {
    return
  }

  pending.value = true

  try {
    const response = await $fetch<{ orderId: string; selfCancelToken?: string }>('/api/orders', {
      method: 'POST',
      body: {
        branchCode: branchCode.value,
        customerName: form.customerName || 'คุณลูกค้า',
        lineUserId: form.lineUserId,
        note: form.note,
        items: cart.items.map(item => ({
          assetId: item.assetId || undefined,
          machineId: item.machineId || undefined,
          priceId: item.priceId
        }))
      }
    })

    cart.clear()
    const tokenQuery = response.selfCancelToken ? `?ct=${encodeURIComponent(response.selfCancelToken)}` : ''
    await router.push(`/orders/${response.orderId}${tokenQuery}`)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="section-card p-4">
    <div>
      <p class="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700/70">Step 4</p>
      <h3 class="text-lg font-semibold text-slate-900">Checkout. ชำระบริการ</h3>
    </div>

    <div class="mt-4 space-y-4">
      <UFormField label="ชื่อลูกค้า">
        <UInput v-model="form.customerName" placeholder="เช่น คุณต่าย หรือใช้ค่าเริ่มต้น" size="xl" />
      </UFormField>

      <UFormField label="LINE User ID">
        <UInput v-model="form.lineUserId" placeholder="Uxxxxxxxx" size="xl" :readonly="Boolean(profile.userId)" />
        <p class="mt-1 text-xs" :class="profile.verified ? 'text-emerald-700' : 'text-slate-500'">
          {{ profile.verified ? 'ยืนยัน LINE แล้ว ใช้ userId นี้กับ order และ notification' : 'ยังไม่ได้ยืนยันกับ LINE server จะใช้ค่าจาก LIFF/session ปัจจุบัน' }}
        </p>
      </UFormField>

      <UFormField label="หมายเหตุ">
        <UTextarea v-model="form.note" :rows="3" placeholder="เช่น รีด่วนก่อน 18:00" />
      </UFormField>

      <UButton
        block
        size="xl"
        color="primary"
        :loading="pending"
        :disabled="!cart.items.length"
        @click="submitOrder"
      >
        สร้างออเดอร์และขอ QR ชำระเงิน
      </UButton>
    </div>
  </div>
</template>
