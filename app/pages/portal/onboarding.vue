<script setup lang="ts">
definePageMeta({
  middleware: 'portal-auth'
})

type TimelineStep = {
  title: string
  description: string
  icon: string
}

const steps: TimelineStep[] = [
  {
    title: 'Create Tenant',
    description: 'Start by creating your tenant profile. This is the root of your business structure.',
    icon: 'i-lucide-building-2'
  },
  {
    title: 'Add Merchants',
    description: 'Create merchant accounts under the tenant to separate brands or operating entities.',
    icon: 'i-lucide-store'
  },
  {
    title: 'Create Branches',
    description: 'Define physical branches/locations for each merchant to organize machines and operations.',
    icon: 'i-lucide-map-pin'
  },
  {
    title: 'Set Up Assets',
    description: 'Register assets and bind IoT device + machine + product to get operations and orders running.',
    icon: 'i-lucide-cpu'
  }
]

async function startTenantCreation() {
  await navigateTo('/portal/create-tenant')
}
</script>

<template>
  <div class="min-h-[calc(100vh-64px)] bg-slate-100 px-4 py-8 dark:bg-slate-950">
    <div class="mx-auto max-w-5xl space-y-5">
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 p-6 md:p-8">
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div class="max-w-2xl">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Getting started</p>
              <h1 class="mt-2 text-3xl font-bold text-white md:text-4xl">Welcome to Merchant Portal</h1>
              <p class="mt-3 text-sm text-blue-50 md:text-base">
                New account detected. Complete these 4 steps to create your tenant structure and start operations.
              </p>
            </div>
            <UButton
              color="neutral"
              variant="solid"
              size="lg"
              icon="i-lucide-plus"
              class="w-full justify-center bg-white text-slate-900 hover:bg-slate-100 md:w-auto"
              @click="startTenantCreation"
            >
              Create Tenant
            </UButton>
          </div>
        </div>
      </section>

      <UCard class="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="space-y-4">
          <div
            v-for="(step, index) in steps"
            :key="step.title"
            class="relative pl-11"
          >
            <div class="absolute left-0 top-0 flex items-center gap-2">
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {{ index + 1 }}
              </div>
            </div>
            <div
              v-if="index < steps.length - 1"
              class="absolute left-4 top-9 h-[calc(100%-2px)] w-px bg-slate-300 dark:bg-slate-700"
            />

            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div class="flex items-start gap-3">
                  <div class="mt-0.5 rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                    <UIcon :name="step.icon" class="h-5 w-5" />
                  </div>
                  <div>
                    <p class="text-base font-semibold text-slate-900 dark:text-white">{{ step.title }}</p>
                    <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ step.description }}</p>
                  </div>
                </div>
                <UBadge
                  color="neutral"
                  variant="soft"
                  class="w-fit bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20"
                >
                  Pending
                </UBadge>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
