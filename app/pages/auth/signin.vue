<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  auth: false
})

const { signIn } = useAuth()
const { t, ts } = useI18n()
const { data: bootstrapStatus } = await useFetch<{ hasPlatformAdmin: boolean; allowBootstrap: boolean }>(
  '/api/platform/bootstrap-status'
)

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const magicLoading = ref(false)
const magicMessage = ref('')
const errorMessage = ref('')
const authTab = ref<'password' | 'magic'>('password')
const emailError = ref('')
const passwordError = ref('')

const trimmedEmail = computed(() => email.value.trim().toLowerCase())
const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail.value))
const isPasswordValid = computed(() =>
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password.value)
)
const isPlatformBootstrapRequired = computed(() => !!bootstrapStatus.value?.allowBootstrap)
const canLogin = computed(() => isEmailValid.value && isPasswordValid.value && !loading.value && !isPlatformBootstrapRequired.value)
const canSendMagicLink = computed(() => isEmailValid.value && !magicLoading.value && !isPlatformBootstrapRequired.value)

async function loginWithCredentials() {
  if (isPlatformBootstrapRequired.value) {
    await navigateTo('/platform/setup')
    return
  }
  emailError.value = ''
  passwordError.value = ''
  magicMessage.value = ''
  if (!isEmailValid.value) {
    emailError.value = 'Please enter a valid email address.'
    return
  }
  if (!isPasswordValid.value) {
    passwordError.value = 'Password must be at least 8 chars, 1 uppercase, 1 number, 1 special.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const result = await signIn('credentials', {
      email: trimmedEmail.value,
      password: password.value,
      callbackUrl: '/portal',
      redirect: false
    })

    const authResult = result as
      | { ok?: boolean; error?: string | null; status?: number; url?: string | null }
      | undefined

    if (authResult?.error || authResult?.ok === false || authResult?.status === 401) {
      errorMessage.value = 'Email or password is incorrect.'
      return
    }

    const nextUrl = authResult?.url
    if (nextUrl) {
      await navigateTo(nextUrl, { external: nextUrl.startsWith('http') })
      return
    }

    errorMessage.value = 'Unable to sign in. Please try again.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : ts('auth.signInFailed')
  } finally {
    loading.value = false
  }
}

async function loginWithProvider(provider: string) {
  if (isPlatformBootstrapRequired.value) {
    await navigateTo('/platform/setup')
    return
  }
  errorMessage.value = ''
  emailError.value = ''
  passwordError.value = ''
  const callbackUrl = `${window.location.origin}/portal`
  await signIn(provider, { callbackUrl, redirect: true })
}

async function sendMagicLink() {
  if (isPlatformBootstrapRequired.value) {
    await navigateTo('/platform/setup')
    return
  }
  emailError.value = ''
  passwordError.value = ''
  if (!isEmailValid.value) {
    emailError.value = 'Please enter a valid email address.'
    return
  }

  magicLoading.value = true
  errorMessage.value = ''
  magicMessage.value = ''
  try {
    const callbackUrl = `${window.location.origin}/portal`
    await signIn('email', {
      email: trimmedEmail.value,
      callbackUrl,
      redirect: false
    })
    magicMessage.value = ts('auth.magicLinkSuccess')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : ts('auth.magicLinkFailed')
  } finally {
    magicLoading.value = false
  }
}

async function submitAuthForm() {
  if (authTab.value === 'password') {
    await loginWithCredentials()
    return
  }

  await sendMagicLink()
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-120px)] items-start justify-center px-4 pt-0 pb-16 sm:px-6 sm:pt-1 lg:px-8">
    <div class="relative w-full max-w-xl pt-16">
      <div class="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/6">
        <div
          class="flex h-40 w-40 items-center justify-center rounded-full border-4 border-white bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <UIcon name="i-lucide-user-round" class="size-24 text-slate-500 dark:text-slate-300" />
        </div>
      </div>

      <UCard class="rounded-[24px] shadow-2xl shadow-slate-400/15 dark:shadow-slate-950/45" :ui="{
        root: 'rounded-[24px] bg-white/96 dark:bg-slate-900/92 ring-1 ring-slate-200/80 dark:ring-slate-700/80',
        body: 'pt-14 pb-6 px-6 sm:px-8'
      }">
        <div>
          <div class="pt-8 pb-4 text-left">
            <h1 class="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Sign in
            </h1>
            <p class="text-base font-medium text-slate-600 dark:text-slate-300">
              Sign In to manage all your devices
            </p>
            <p
              v-if="bootstrapStatus?.allowBootstrap"
              class="mt-2 text-sm font-medium text-amber-600 dark:text-amber-300"
            >
              Sign in is temporarily disabled until the first platform admin is created.
            </p>
          </div>

          <UAlert
            v-if="isPlatformBootstrapRequired"
            color="warning"
            variant="soft"
            icon="i-lucide-shield-alert"
            title="Platform is not initialized yet"
            description="Create the first platform admin before sign in can be used. This setup is available only once."
            class="mb-5"
          >
            <template #actions>
              <UButton color="warning" variant="solid" @click="navigateTo('/platform/setup')">
                Go to Platform Setup
              </UButton>
            </template>
          </UAlert>

          <form class="space-y-4" @submit.prevent="submitAuthForm">
            <div
              class="grid w-full grid-cols-2 gap-0 overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
              <UButton size="sm" :variant="authTab === 'password' ? 'solid' : 'ghost'"
                :color="authTab === 'password' ? 'primary' : 'neutral'"
                :class="authTab === 'password'
                  ? 'rounded-none text-white'
                  : 'rounded-none bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'" block
                type="button"
                @click="authTab = 'password'">
                Password
              </UButton>
              <UButton size="sm" :variant="authTab === 'magic' ? 'solid' : 'ghost'"
                :color="authTab === 'magic' ? 'primary' : 'neutral'"
                :class="authTab === 'magic'
                  ? 'rounded-none text-white'
                  : 'rounded-none bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'" block
                type="button"
                @click="authTab = 'magic'">
                Magic Link
              </UButton>
            </div>

            <UFormField :label="ts('auth.email')" class="text-base font-semibold text-slate-800 dark:text-slate-200"
              required>
              <UInput v-model="email" type="email" :placeholder="ts('auth.email')" size="xl" color="neutral"
                variant="outline" class="w-full"
                :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }" />
              <template #help>
                <p v-if="emailError" class="text-xs font-semibold text-rose-600">
                  {{ emailError }}
                </p>
              </template>
            </UFormField>

            <UFormField v-if="authTab === 'password'" :label="ts('auth.password')"
              class="text-base font-semibold text-slate-800 dark:text-slate-200" required>
              <UInput v-model="password" :type="showPassword ? 'text' : 'password'" :placeholder="ts('auth.password')"
                size="xl" color="neutral" variant="outline" class="w-full"
                :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }">
                <template #trailing>
                  <UButton color="neutral" variant="ghost" size="md"
                    class="inline-flex h-9 w-9 items-center justify-center rounded-full p-0 text-slate-600 dark:text-slate-300"
                    type="button"
                    @click="showPassword = !showPassword">
                    <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-5" />
                  </UButton>
                </template>
              </UInput>
              <template #help>
                <p class="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Password hint: at least 8 chars, 1 Capital, 1 number, 1 special
                </p>
                <p v-if="passwordError" class="text-xs font-semibold text-rose-600">
                  {{ passwordError }}
                </p>
              </template>
            </UFormField>

            <div class="space-y-4 pt-6">
              <div v-if="authTab === 'password'" class="text-right text-sm font-semibold">
                <NuxtLink to="/auth/forgot-password"
                  class="text-slate-600 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300">
                  Forget password?
                </NuxtLink>
              </div>

              <UButton v-if="authTab === 'password'" :loading="loading" :disabled="!canLogin" color="primary" block
                size="xl" class="text-white dark:text-white rounded-full" type="submit">
                {{ t('auth.login') }}
              </UButton>
              <UButton v-else :loading="magicLoading" :disabled="!canSendMagicLink" color="primary" block size="xl"
                class="text-white dark:text-white rounded-full" type="submit">
                {{ ts('auth.sendMagicLink') }}
              </UButton>

              <p v-if="authTab === 'magic' && magicMessage" class="text-center text-sm font-semibold text-emerald-600">
                {{ magicMessage }}
              </p>

              <div class="text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                Do not have an account?
                <NuxtLink to="/signup"
                  class="ml-1 text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-300">
                  Sign Up
                </NuxtLink>
              </div>
            </div>
          </form>

          <div class="flex items-center gap-3 pt-1">
            <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">
              or connect with
            </p>
            <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <div class="flex items-center justify-center gap-4">
            <UButton color="neutral" variant="ghost" size="xl"
              class="inline-flex h-12 w-12 items-center justify-center rounded-full p-0 text-slate-700 transition-all duration-200 hover:scale-150 hover:bg-blue-150 dark:text-slate-100 dark:hover:bg-slate-800"
              @click="loginWithProvider('google')">
              <UIcon name="i-simple-icons-google" class="size-7 text-[#4285F4]" />
            </UButton>
            <UButton color="neutral" variant="ghost" size="xl"
              class="inline-flex h-12 w-12 items-center justify-center rounded-full p-0 text-slate-700 transition-all duration-200 hover:scale-150 hover:bg-emerald-150 dark:text-slate-100 dark:hover:bg-slate-800"
              @click="loginWithProvider('line')">
              <UIcon name="i-simple-icons-line" class="size-7 text-[#06C755]" />
            </UButton>
            <UButton color="neutral" variant="ghost" size="xl"
              class="inline-flex h-12 w-12 items-center justify-center rounded-full p-0 text-slate-700 transition-all duration-200 hover:scale-150 hover:bg-emerald-150 dark:text-slate-100 dark:hover:bg-slate-800"
              @click="loginWithProvider('github')">
              <UIcon name="i-simple-icons-github" class="size-7 text-[#817f7f]" />
            </UButton>
          </div>

          <UAlert v-if="errorMessage" color="error" variant="soft" icon="i-lucide-alert-triangle"
            :title="errorMessage" />
        </div>
      </UCard>
    </div>
  </div>
</template>
