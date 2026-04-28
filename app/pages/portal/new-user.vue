<script setup lang="ts">
import { resolvePortalHome } from '~/utils/portal'

definePageMeta({
  middleware: 'portal-auth'
})

const { data, getSession } = useAuth()
await getSession()

const user = computed(() => data.value?.user)
if (user.value?.tenantId) {
  await navigateTo(resolvePortalHome(user.value.role))
}

const decision = ref<'owner' | 'member' | ''>('')
const workspaceCode = ref('')
const loading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

function chooseOwner() {
  decision.value = 'owner'
  errorMessage.value = ''
  infoMessage.value = ''
}

function chooseMember() {
  decision.value = 'member'
  errorMessage.value = ''
  infoMessage.value = ''
}

async function continueOwnerFlow() {
  errorMessage.value = ''
  infoMessage.value = ''
  await navigateTo('/portal/onboarding')
}

async function joinByCode() {
  const code = workspaceCode.value.trim()
  if (!code) {
    errorMessage.value = 'Please enter Tenant Code or Merchant Code.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const response = await $fetch<{ message: string }>('/api/portal/join-workspace', {
      method: 'POST',
      body: { code }
    })
    infoMessage.value = response.message || 'Workspace linked successfully.'
    await getSession()
    await navigateTo('/app/dashboard')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Unable to join workspace.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-64px)] bg-slate-100 px-4 py-8 dark:bg-slate-950">
    <div class="mx-auto max-w-3xl space-y-5">
      <UCard class="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <template #header>
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">New user setup</p>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">How will you use this portal?</h1>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              Choose one option to continue. You can switch later with admin support.
            </p>
          </div>
        </template>

        <div class="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            class="rounded-xl border p-4 text-left text-slate-900 transition dark:text-slate-100"
            :class="decision === 'owner'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:border-blue-400 dark:bg-slate-800/90 dark:ring-blue-400/25'
              : 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-blue-500'"
            @click="chooseOwner"
          >
            <p class="text-sm font-semibold">I want to open/manage my own store</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              We will guide you to set up tenant, merchants, branches, and assets.
            </p>
          </button>

          <button
            type="button"
            class="rounded-xl border p-4 text-left text-slate-900 transition dark:text-slate-100"
            :class="decision === 'member'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:border-blue-400 dark:bg-slate-800/90 dark:ring-blue-400/25'
              : 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-blue-500'"
            @click="chooseMember"
          >
            <p class="text-sm font-semibold">I already belong to a store</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Enter Tenant Code or Merchant Code to join your workspace.
            </p>
          </button>
        </div>
      </UCard>

      <UCard
        v-if="decision === 'owner'"
        class="border border-blue-200 bg-blue-50/60 dark:border-blue-400/20 dark:bg-blue-500/10"
      >
        <div class="space-y-3">
          <p class="text-base font-semibold text-slate-900 dark:text-white">Owner confirmation</p>
          <p class="text-sm text-slate-700 dark:text-slate-300">
            You are about to open a new store workspace. We will set up your account as tenant owner during onboarding.
            Do you want to continue?
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton color="primary" icon="i-lucide-check" @click="continueOwnerFlow">
              <template #leading>
                <UIcon v-if="loading" name="i-lucide-loader-2" class="animate-spin" />
                <UIcon v-else name="i-lucide-check" />
              </template>
              Yes, continue
            </UButton>
            <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="decision = ''">
              Not now
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard
        v-if="decision === 'member'"
        class="border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="space-y-3">
          <UFormField label="Tenant Code or Merchant Code" required>
            <UInput
              v-model="workspaceCode"
              placeholder="Example: Company-A or WashPoint"
              size="lg"
              color="neutral"
              variant="outline"
              :ui="{
                base: 'bg-white text-slate-900 placeholder:text-slate-500 ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-slate-600'
              }"
            />
          </UFormField>

          <div class="flex flex-wrap gap-2">
            <UButton color="primary" :loading="loading" icon="i-lucide-link" @click="joinByCode">
              Join workspace
            </UButton>
            <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left" @click="decision = ''">
              Back
            </UButton>
          </div>

          <p v-if="errorMessage" class="text-sm font-medium text-rose-600">{{ errorMessage }}</p>
          <p v-if="infoMessage" class="text-sm font-medium text-emerald-600">{{ infoMessage }}</p>
        </div>
      </UCard>

      <p v-if="errorMessage && decision === 'owner'" class="text-sm font-medium text-rose-600">{{ errorMessage }}</p>
    </div>
  </div>
</template>
