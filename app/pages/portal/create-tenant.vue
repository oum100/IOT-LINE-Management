<script setup lang="ts">
definePageMeta({
  middleware: 'portal-auth'
})

const { data, getSession } = useAuth()
await getSession()

const user = computed(() => data.value?.user)
if (user.value?.tenantId) {
  await navigateTo('/app/status')
}

const loading = ref(false)
const errorMessage = ref('')
const code = ref('')
const name = ref('')

async function submitCreateTenant() {
  const tenantCode = code.value.trim()
  const tenantName = name.value.trim()
  if (!tenantCode) {
    errorMessage.value = 'Tenant Code is required.'
    return
  }
  if (!tenantName) {
    errorMessage.value = 'Tenant Name is required.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/portal/create-tenant', {
      method: 'POST',
      body: {
        code: tenantCode,
        name: tenantName
      }
    })
    await getSession()
    await navigateTo('/app/status')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Unable to create tenant.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-64px)] bg-slate-100 px-4 py-8 dark:bg-slate-950">
    <div class="mx-auto max-w-2xl">
      <UCard class="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <template #header>
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Owner setup</p>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Create Tenant</h1>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              This creates your first tenant workspace under your portal account.
            </p>
          </div>
        </template>

        <div class="space-y-4">
          <UFormField label="Tenant Code" required>
            <UInput
              v-model="code"
              placeholder="Example: Company-A"
              size="lg"
              color="neutral"
              variant="outline"
              :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-600' }"
            />
          </UFormField>

          <UFormField label="Tenant Name" required>
            <UInput
              v-model="name"
              placeholder="Example: Company A"
              size="lg"
              color="neutral"
              variant="outline"
              :ui="{ base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-600' }"
            />
          </UFormField>

          <div class="flex flex-wrap gap-2">
            <UButton color="primary" :loading="loading" icon="i-lucide-plus" @click="submitCreateTenant">
              Create Tenant
            </UButton>
            <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left" @click="navigateTo('/portal/onboarding')">
              Back
            </UButton>
          </div>

          <p v-if="errorMessage" class="text-sm font-medium text-rose-600">{{ errorMessage }}</p>
        </div>
      </UCard>
    </div>
  </div>
</template>
