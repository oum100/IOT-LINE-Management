<script setup lang="ts">
import { onMounted, ref } from 'vue'

const adminKey = ref('')
const paymentExpiryMinutes = ref(15)
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const error = ref('')

async function loadSettings() {
  loading.value = true
  error.value = ''
  message.value = ''

  try {
    const response = await $fetch<{ paymentExpiryMinutes: number }>('/api/admin/settings', {
      headers: adminKey.value ? { 'x-admin-key': adminKey.value } : undefined
    })

    paymentExpiryMinutes.value = response.paymentExpiryMinutes || 15
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load admin settings'
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  error.value = ''
  message.value = ''

  try {
    const response = await $fetch<{ success: boolean, paymentExpiryMinutes: number }>('/api/admin/settings/payment-expiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey.value ? { 'x-admin-key': adminKey.value } : {})
      },
      body: {
        paymentExpiryMinutes: paymentExpiryMinutes.value
      }
    })

    paymentExpiryMinutes.value = response.paymentExpiryMinutes || paymentExpiryMinutes.value
    message.value = `Saved. Payment timeout is now ${paymentExpiryMinutes.value} minutes.`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to save admin settings'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="mx-auto w-full max-w-none px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
    <div class="section-card p-5">
      <p class="text-xs font-semibold uppercase tracking-[0.25em] text-orange-500">Admin</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-900">Payment Timeout Settings</h1>
      <p class="mt-2 text-sm text-slate-600">Set how many minutes an order can wait for payment before auto-cancel.</p>

      <div class="mt-5 space-y-4">
        <UFormField label="Admin API Key (optional)">
          <UInput
            v-model="adminKey"
            placeholder="x-admin-key"
            size="lg"
            type="password"
          />
        </UFormField>

        <UFormField label="Payment Expiry (minutes)">
          <UInput
            v-model.number="paymentExpiryMinutes"
            type="number"
            min="1"
            max="1440"
            size="lg"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            color="neutral"
            variant="soft"
            :loading="loading"
            @click="loadSettings"
          >
            Reload
          </UButton>
          <UButton
            color="warning"
            :loading="saving"
            @click="saveSettings"
          >
            Save
          </UButton>
        </div>

        <p v-if="message" class="text-sm font-medium text-emerald-700">{{ message }}</p>
        <p v-if="error" class="text-sm font-medium text-red-600">{{ error }}</p>
      </div>
    </div>
  </div>
</template>
