<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  auth: false
})

const { signIn, data } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')

const inputUi = {
  base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-500'
}

const { data: bootstrapStatus } = await useFetch<{ hasPlatformAdmin: boolean; allowBootstrap: boolean }>('/api/platform/bootstrap-status')

if (bootstrapStatus.value?.hasPlatformAdmin) {
  const role = String(data.value?.user?.role || '').toUpperCase()
  await navigateTo(role === 'ADMIN' || role === 'USER' ? '/platform/dashboard' : '/auth/signin')
}

const trimmedEmail = computed(() => email.value.trim().toLowerCase())
const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail.value))
const passwordValid = computed(() => /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password.value))
const passwordMatched = computed(() => password.value === confirmPassword.value)
const canSubmit = computed(() =>
  !!name.value.trim() && emailValid.value && passwordValid.value && passwordMatched.value && !loading.value
)

async function createPlatformAdmin() {
  errorMessage.value = ''
  if (!canSubmit.value) {
    errorMessage.value = 'Please complete all required fields.'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/admin/users/bootstrap', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        email: trimmedEmail.value,
        password: password.value
      }
    })

    const result = await signIn('credentials', {
      email: trimmedEmail.value,
      password: password.value,
      callbackUrl: '/platform/dashboard',
      redirect: false
    })

    const authResult = result as { url?: string | null; error?: string | null; ok?: boolean } | undefined
    if (authResult?.error || authResult?.ok === false) {
      await navigateTo('/auth/signin')
      return
    }

    await navigateTo(authResult?.url || '/platform/dashboard')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to create platform admin.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-120px)] items-start justify-center px-4 pt-6 pb-16 sm:px-6 lg:px-8">
    <div class="w-full max-w-3xl">
      <UCard :ui="{ root: 'rounded-[28px] bg-white/96 shadow-2xl shadow-slate-400/15 ring-1 ring-slate-200/80 dark:bg-slate-900/92 dark:ring-slate-700/80 dark:shadow-slate-950/45' }">
        <div class="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div class="space-y-5">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">Platform Bootstrap</p>
              <h1 class="mt-2 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Create the first Platform Admin</h1>
              <p class="mt-3 text-base text-slate-600 dark:text-slate-300">
                This setup is available only once. After the first platform admin is created, all future admin users must be managed from the platform itself.
              </p>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Bootstrap flow summary</p>
              <div class="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>1. If no platform admin exists yet, this page is the only allowed entry point.</p>
                <p>2. The account is always created as `ADMIN` without tenant, merchant, or branch binding.</p>
                <p>3. Once the first admin exists, this page closes automatically and future admins must be created from `admin/users`.</p>
                <p>4. After submit, we sign you in immediately and send you to the platform dashboard.</p>
              </div>
            </div>
          </div>

          <div class="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <UAlert
              v-if="errorMessage"
              color="error"
              variant="soft"
              icon="i-lucide-alert-triangle"
              :title="errorMessage"
            />

            <UFormField>
              <template #label><span>Name <span class="text-rose-500">*</span></span></template>
              <UInput
                v-model="name"
                placeholder="Platform owner"
                :ui="inputUi"
              />
            </UFormField>

            <UFormField>
              <template #label><span>Email <span class="text-rose-500">*</span></span></template>
              <UInput
                v-model="email"
                type="email"
                placeholder="admin@company.com"
                :ui="inputUi"
              />
            </UFormField>

            <UFormField>
              <template #label><span>Password <span class="text-rose-500">*</span></span></template>
              <UInput
                v-model="password"
                type="password"
                placeholder="At least 8 characters"
                :ui="inputUi"
              />
              <template #help>
                <p class="text-sm text-slate-500 dark:text-slate-400">Use at least 8 characters with 1 uppercase, 1 number, and 1 special character.</p>
              </template>
            </UFormField>

            <UFormField>
              <template #label><span>Confirm Password <span class="text-rose-500">*</span></span></template>
              <UInput
                v-model="confirmPassword"
                type="password"
                placeholder="Repeat password"
                :ui="inputUi"
              />
            </UFormField>

            <UButton
              color="primary"
              block
              size="xl"
              class="rounded-xl text-white"
              :disabled="!canSubmit"
              :loading="loading"
              @click="createPlatformAdmin"
            >
              Create Platform Admin
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
