<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from '#app'
import { useRoute } from '#imports'
import type { MachineWithPrices } from '~~/shared/types'
import { useCartStore } from '~~/stores/cart'
import { useLineLiff } from '~~/composables/useLineLiff'

const route = useRoute()
const branchCode = computed(() => String(route.query.branchCode || '').trim())
const { data: machines, refresh: refreshMachines } = await useFetch<MachineWithPrices[]>('/api/machines', {
  query: computed(() => branchCode.value ? { branchCode: branchCode.value } : {})
})
const cart = useCartStore()
const { profile, init, login } = useLineLiff()
const router = useRouter()
const pending = ref(false)
let machineRefreshTimer: ReturnType<typeof setInterval> | null = null
const profileDisplayName = computed(() => profile.value.displayName?.trim() || 'คุณลูกค้า')
const profilePictureUrl = computed(() => profile.value.pictureUrl?.trim() || 'https://api.dicebear.com/9.x/glass/svg?seed=LaundryCustomer')
const hasBranchCode = computed(() => Boolean(branchCode.value))

const selectedMachineIds = ref<string[]>([])
const selectedPrices = ref<Record<string, string>>({})

const allMachines = computed(() => machines.value || [])
const washers = computed(() => allMachines.value.filter(machine => machine.kind === 'WASHER'))
const dryers = computed(() => allMachines.value.filter(machine => machine.kind === 'DRYER'))
const availableWashers = computed(() => washers.value.filter(machine => machine.status === 'AVAILABLE'))
const availableDryers = computed(() => dryers.value.filter(machine => machine.status === 'AVAILABLE'))
const machineRows = computed(() =>
  Array.from({ length: 6 }, (_, index) => ({
    washer: washers.value[index] || null,
    dryer: dryers.value[index] || null
  }))
)
const selectedMachines = computed(() =>
  allMachines.value.filter(machine => selectedMachineIds.value.includes(machine.id))
)

function toggleMachine(machine: MachineWithPrices) {
  if (machine.status !== 'AVAILABLE') {
    return
  }

  if (selectedMachineIds.value.includes(machine.id)) {
    selectedMachineIds.value = selectedMachineIds.value.filter(id => id !== machine.id)
    delete selectedPrices.value[machine.id]
    return
  }

  selectedMachineIds.value.push(machine.id)
}

function choosePrice(machineId: string, priceId: string) {
  selectedPrices.value[machineId] = priceId
}

watch(
  [selectedMachines, selectedPrices],
  () => {
    cart.replaceSelections(
      selectedMachines.value.flatMap((machine) => {
        const priceId = selectedPrices.value[machine.id]
        if (!priceId) {
          return []
        }

        return [{
          machine,
          priceId
        }]
      })
    )
  },
  { deep: true, immediate: true }
)

onMounted(() => {
  init(true, branchCode.value || undefined)
  machineRefreshTimer = setInterval(() => {
    refreshMachines()
  }, 5000)
})
onBeforeUnmount(() => {
  if (machineRefreshTimer) {
    clearInterval(machineRefreshTimer)
  }
})

const customerName = computed(() => profileDisplayName.value)
const lineUserId = computed(() => profile.value.userId?.trim() || '')

const canCheckout = computed(() => {
  return hasBranchCode.value && cart.items.length > 0
})

async function submitOrder() {
  if (!canCheckout.value) {
    return
  }

  pending.value = true

  try {
    const response = await $fetch<{ orderId: string; selfCancelToken?: string }>('/api/orders', {
      method: 'POST',
      body: {
        branchCode: branchCode.value,
        customerName: customerName.value || 'คุณลูกค้า',
        lineUserId: lineUserId.value || '',
        note: null,
        items: cart.items.map(item => ({
          machineId: item.machineId,
          priceId: item.priceId
        }))
      }
    })

    cart.clear()
    const query = new URLSearchParams()
    if (response.selfCancelToken) query.set('ct', response.selfCancelToken)
    if (branchCode.value) query.set('branchCode', branchCode.value)
    const queryString = query.toString()
    await router.push(`/orders/${response.orderId}${queryString ? `?${queryString}` : ''}`)
  } finally {
    pending.value = false
  }
}

function statusLabel(machine: MachineWithPrices) {
  const status = machine.assetStatus || (machine.status === 'AVAILABLE' ? 'ACTIVE' : machine.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'INACTIVE')
  if (status === 'ACTIVE') return 'ACTIVE'
  if (status === 'MAINTENANCE') return 'MAINTENANCE'
  return 'INACTIVE'
}

function statusMinutes(machine: MachineWithPrices) {
  if (machine.status !== 'RUNNING') {
    return ''
  }

  const remain = Math.max(0, Number(machine.remainingMinutes ?? 0))
  return String(remain).padStart(2, '0')
}

function statusClasses(machine: MachineWithPrices) {
  const status = machine.assetStatus || (machine.status === 'AVAILABLE' ? 'ACTIVE' : machine.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'INACTIVE')
  if (status === 'ACTIVE') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }
  if (status === 'MAINTENANCE') {
    return 'border-orange-200 bg-orange-50 text-orange-700'
  }
  return 'border-rose-200 bg-rose-50 text-rose-700'
}

function statusDotClass(machine: MachineWithPrices) {
  const status = machine.assetStatus || (machine.status === 'AVAILABLE' ? 'ACTIVE' : machine.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'INACTIVE')
  if (status === 'ACTIVE') {
    return 'bg-emerald-500'
  }
  if (status === 'MAINTENANCE') {
    return 'bg-orange-400'
  }
  return 'bg-rose-500'
}
</script>

<template>
  <div class="mx-auto grid w-full max-w-6xl gap-5 p-4 sm:p-6 lg:grid-cols-[1.25fr_0.95fr]">
    <section class="space-y-5">
      <div class="section-card p-5">
        <div class="flex items-center gap-4">
          <img
            :src="profilePictureUrl"
            :alt="profileDisplayName"
            class="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-100"
          >
          <div>
            <h2 class="mt-1 max-w-[15rem] break-words text-lg font-semibold leading-tight text-slate-900 sm:max-w-none sm:text-xl">
              สวัสดี {{ profileDisplayName }}
            </h2>
            <p class="mt-2 text-sm text-slate-600">ใช้พร้อมกันหลายเครื่องได้</p>
            <p v-if="profile.loading" class="mt-1 text-xs text-slate-500">กำลังเชื่อมต่อ LINE LIFF...</p>
            <p v-if="!hasBranchCode" class="mt-1 text-xs text-rose-600">ไม่พบ branch code ใน URL</p>
            <p v-else-if="profile.verified" class="mt-1 text-xs text-emerald-700">
              <UIcon name="i-lucide-badge-check" class="align-middle text-base" />
            </p>
            <p v-if="profile.verificationError" class="mt-1 text-xs text-amber-700">ตรวจสอบ LINE ไม่สำเร็จ: {{ profile.verificationError }}</p>
            <p v-else-if="profile.error" class="mt-1 text-xs text-amber-700">LIFF: {{ profile.error }}</p>
            <button
              v-if="profile.ready && !profile.loggedIn"
              type="button"
              class="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              @click="login"
            >
              Login LINE
            </button>
          </div>
        </div>
      </div>

      <div class="section-card p-5">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div class="max-w-xs">
            <p class="text-sm font-semibold uppercase tracking-[0.25em] text-orange-500">Step 1</p>
            <div class="mt-2 flex items-center justify-center gap-6 text-base font-medium leading-6 text-slate-700">
              <span>ซักว่าง {{ availableWashers.length }}</span>
              <span>อบว่าง {{ availableDryers.length }}</span>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-x-4 gap-y-2 text-sm font-medium leading-5 text-slate-700">
            <div class="text-center">
              <div class="mx-auto mb-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p>ว่าง</p>
            </div>
            <div class="text-center">
              <div class="mx-auto mb-1 h-2.5 w-2.5 rounded-full bg-orange-400" />
              <p>ติดจอง</p>
            </div>
            <div class="text-center">
              <div class="mx-auto mb-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
              <p>ไม่ว่าง</p>
            </div>
            <div class="text-center">
              <div class="mx-auto mb-1 h-2.5 w-2.5 rounded-full bg-slate-400" />
              <p>Offline</p>
            </div>
          </div>
        </div>

        <div class="mt-5 grid gap-3">
          <div
            v-for="(row, index) in machineRows"
            :key="index"
            class="grid grid-cols-2 gap-3"
          >
            <button
              v-for="machine in [row.washer, row.dryer].filter(Boolean)"
              :key="machine!.id"
              class="rounded-2xl border px-3 py-2.5 text-center transition"
              :class="[
                statusClasses(machine!),
                machine!.status === 'AVAILABLE' ? 'hover:-translate-y-0.5 hover:border-emerald-400' : 'cursor-not-allowed opacity-90',
                selectedMachineIds.includes(machine!.id) ? '!border-teal-700 !bg-teal-100/80 ring-4 ring-teal-300 shadow-lg shadow-teal-200/70' : ''
              ]"
              :disabled="machine!.status !== 'AVAILABLE'"
              @click="toggleMachine(machine!)"
            >
              <div class="flex flex-col items-center justify-center gap-2">
                <div class="min-w-0">
                  <p class="text-base font-semibold leading-tight tracking-tight sm:text-lg">{{ machine!.name }}</p>
                  <div class="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-medium opacity-90 sm:text-sm">
                    <span class="h-2 w-2 shrink-0 rounded-full" :class="statusDotClass(machine!)" />
                    <span class="leading-tight">
                      <template v-if="machine!.status === 'RUNNING'">
                        Busy {{ statusMinutes(machine!) }} <span class="text-[10px] align-middle sm:text-[11px]">min</span>
                      </template>
                      <template v-else>
                        {{ statusLabel(machine!) }}
                      </template>
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div class="section-card p-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.25em] text-orange-500">Step 2</p>
            <h3 class="mt-1 text-lg font-semibold text-slate-900">เลือกราคาบริการ (บาท)</h3>
          </div>
          <UBadge :color="selectedMachines.length ? 'success' : 'warning'" variant="soft">
            {{ selectedMachines.length ? `${selectedMachines.length} เครื่องที่เลือก` : 'ยังไม่ได้เลือกเครื่อง' }}
          </UBadge>
        </div>

        <div v-if="selectedMachines.length" class="mt-4 grid gap-4">
          <MachinePicker
            v-for="machine in selectedMachines"
            :key="machine.id"
            :machine="machine"
            :selected-price-id="selectedPrices[machine.id]"
            @select="priceId => choosePrice(machine.id, priceId)"
          />
        </div>

        <div v-else class="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          เลือกเครื่องสีเขียวก่อน แล้วแต่ละเครื่องจะมี 3 ราคาให้เลือกในบรรทัดเดียว
        </div>
      </div>
    </section>

    <section class="space-y-5">
      <CartSummary :pending="pending" :can-checkout="canCheckout" @checkout="submitOrder" />
    </section>
  </div>
</template>
