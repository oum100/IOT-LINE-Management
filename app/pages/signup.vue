<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  auth: false
})

const router = useRouter()

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const trimmedEmail = computed(() => form.email.trim().toLowerCase())
const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail.value))
const isPasswordValid = computed(() =>
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(form.password)
)
const isConfirmValid = computed(() => form.password.length > 0 && form.password === form.confirmPassword)
const canSubmit = computed(
  () => isEmailValid.value && isPasswordValid.value && isConfirmValid.value && !loading.value
)

async function cancelAndBack() {
  if (process.client && window.history.length > 1) {
    router.back()
    return
  }
  await router.push('/auth/signin')
}

async function submitRegister() {
  successMessage.value = ''
  errorMessage.value = ''

  if (!isEmailValid.value) {
    errorMessage.value = 'Please enter a valid email address.'
    return
  }
  if (!isPasswordValid.value) {
    errorMessage.value = 'Password must be at least 8 chars, 1 uppercase, 1 number, 1 special.'
    return
  }
  if (!isConfirmValid.value) {
    errorMessage.value = 'Password confirmation does not match.'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        name: form.name.trim() || undefined,
        email: trimmedEmail.value,
        password: form.password
      }
    })
    successMessage.value = 'Account created. Please check your email to verify your account, then sign in.'
    setTimeout(() => {
      router.push('/auth/signin')
    }, 1800)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Unable to register'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-140px)] items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
    <UCard
      class="w-full max-w-xl rounded-[24px] shadow-xl shadow-slate-400/15 dark:shadow-slate-950/40"
      :ui="{
        root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200/80 dark:ring-slate-700/80',
        header: 'border-b border-slate-200/70 dark:border-slate-700/70'
      }"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold text-slate-900 dark:text-white">
            Create account
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
          Create your account with email and password.
        </p>

        <UFormField label="Name (optional)" class="text-base font-semibold text-slate-800 dark:text-slate-100">
          <UInput
            v-model="form.name"
            placeholder="Your name"
            size="xl"
            color="neutral"
            variant="outline"
            class="w-full"
            :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }"
          />
        </UFormField>

        <UFormField label="Email" required class="text-base font-semibold text-slate-800 dark:text-slate-100">
          <UInput
            v-model="form.email"
            type="email"
            placeholder="Email"
            size="xl"
            color="neutral"
            variant="outline"
            class="w-full"
            :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }"
          />
        </UFormField>

        <UFormField label="Password" required class="text-base font-semibold text-slate-800 dark:text-slate-100">
          <UInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Password"
            size="xl"
            color="neutral"
            variant="outline"
            class="w-full"
            :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }"
          >
            <template #trailing>
              <UButton color="neutral" variant="ghost" size="md" class="inline-flex h-9 w-9 items-center justify-center rounded-full p-0 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white" @click="showPassword = !showPassword">
                <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-5" />
              </UButton>
            </template>
          </UInput>
          <template #help>
            <p class="text-xs font-medium text-slate-600 dark:text-slate-300">
              At least 8 chars, 1 Capital, 1 number, 1 special
            </p>
          </template>
        </UFormField>

        <UFormField label="Confirm password" required class="text-base font-semibold text-slate-800 dark:text-slate-100">
          <UInput
            v-model="form.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="Confirm password"
            size="xl"
            color="neutral"
            variant="outline"
            class="w-full"
            :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }"
          >
            <template #trailing>
              <UButton color="neutral" variant="ghost" size="md" class="inline-flex h-9 w-9 items-center justify-center rounded-full p-0 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white" @click="showConfirmPassword = !showConfirmPassword">
                <UIcon :name="showConfirmPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-5" />
              </UButton>
            </template>
          </UInput>
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

        <div class="flex gap-3 pt-2">
          <UButton
            color="primary"
            variant="solid"
            size="lg"
            class="text-white"
            :loading="loading"
            :disabled="!canSubmit"
            @click="submitRegister"
          >
            Create account
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
