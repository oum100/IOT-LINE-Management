<script setup lang="ts">
const { signIn } = useAuth()

const email = ref('')
const password = ref('')
const signupName = ref('')
const magicEmail = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function loginWithCredentials() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await signIn('credentials', {
      email: email.value,
      password: password.value,
      callbackUrl: '/order'
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Sign in failed'
  } finally {
    loading.value = false
  }
}

async function registerAccount() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        name: signupName.value || undefined,
        tenantCode: 'washpoint',
        merchantCode: '1000105'
      }
    })
    successMessage.value = 'สมัครสมาชิกสำเร็จแล้ว ลองเข้าสู่ระบบได้ทันที'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Register failed'
  } finally {
    loading.value = false
  }
}

async function loginWithProvider(provider: string) {
  await signIn(provider, { callbackUrl: '/order' })
}

async function sendMagicLink() {
  if (!magicEmail.value) return
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await signIn('email', {
      email: magicEmail.value,
      callbackUrl: '/order',
      redirect: false
    })
    successMessage.value = 'ส่ง Magic Link แล้ว กรุณาเช็คอีเมล'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Magic Link failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-lg p-4 sm:p-6">
    <div class="section-card p-6">
      <p class="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600">Auth</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-900">Sign in / Sign up</h1>
      <p class="mt-2 text-sm text-slate-600">รองรับ Email + Password, Google, LINE และ Magic Link</p>

      <div class="mt-5 space-y-3">
        <UInput v-model="signupName" placeholder="ชื่อ (optional)" size="lg" />
        <UInput v-model="email" type="email" placeholder="อีเมล" size="lg" />
        <UInput v-model="password" type="password" placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)" size="lg" />
        <div class="grid grid-cols-2 gap-3">
          <UButton :loading="loading" color="primary" @click="loginWithCredentials">Login</UButton>
          <UButton :loading="loading" color="neutral" variant="soft" @click="registerAccount">Register</UButton>
        </div>
      </div>

      <div class="mt-5 space-y-3">
        <UButton color="neutral" variant="outline" block @click="loginWithProvider('google')">Login Google</UButton>
        <UButton color="neutral" variant="outline" block @click="loginWithProvider('line')">Login LINE</UButton>
      </div>

      <div class="mt-5 space-y-3 rounded-xl border border-slate-200 p-3">
        <p class="text-sm font-medium text-slate-700">Magic Link</p>
        <UInput v-model="magicEmail" type="email" placeholder="email@example.com" size="lg" />
        <UButton :loading="loading" color="warning" block @click="sendMagicLink">Send Magic Link</UButton>
      </div>

      <p v-if="successMessage" class="mt-4 text-sm font-medium text-emerald-700">{{ successMessage }}</p>
      <p v-if="errorMessage" class="mt-2 text-sm font-medium text-rose-600">{{ errorMessage }}</p>
    </div>
  </div>
</template>
