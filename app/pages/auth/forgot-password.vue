<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  auth: false
})

const { ts } = useI18n()
const router = useRouter()

const email = ref('')
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const trimmedEmail = computed(() => email.value.trim().toLowerCase())
const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail.value))

async function cancelAndBack() {
  if (process.client && window.history.length > 1) {
    router.back()
    return
  }
  await router.push('/auth/signin')
}

async function submitForgotPassword() {
  successMessage.value = ''
  errorMessage.value = ''

  if (!isEmailValid.value) {
    errorMessage.value = 'Please enter a valid email address.'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: {
        email: trimmedEmail.value
      }
    })
    successMessage.value = 'Reset link sent. Please check your email.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Unable to send reset link'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-140px)] items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
    <UCard
      class="w-full max-w-lg rounded-[24px] shadow-xl shadow-slate-400/15 dark:shadow-slate-950/40"
      :ui="{
        root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200/80 dark:ring-slate-700/80',
        header: 'border-b border-slate-200/70 dark:border-slate-700/70'
      }"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
            Forgot Password
          </h1>
          <UButton
            color="neutral"
            variant="ghost"
            size="md"
            class="rounded-full text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Cancel"
            @click="cancelAndBack"
          >
            <UIcon name="i-lucide-x" class="size-5" />
          </UButton>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm font-medium text-slate-700 dark:text-slate-200">
          Enter your registered email and we will send a password reset link.
        </p>

        <UFormField :label="ts('auth.email')" required class="text-base font-semibold text-slate-800 dark:text-slate-100">
          <UInput
            v-model="email"
            type="email"
            :placeholder="ts('auth.email')"
            size="xl"
            color="neutral"
            variant="outline"
            class="w-full"
            :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }"
          />
        </UFormField>

        <UAlert
          v-if="successMessage"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle-2"
          :title="successMessage"
        />
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          :title="errorMessage"
        />

        <div class="flex gap-3">
          <UButton
            color="primary"
            variant="solid"
            class="text-white"
            size="lg"
            :loading="loading"
            :disabled="!isEmailValid || loading"
            @click="submitForgotPassword"
          >
            Send Reset Link
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            size="lg"
            class="text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700"
            @click="cancelAndBack"
          >
            Back to Sign in
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
