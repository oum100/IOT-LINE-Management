<script setup lang="ts">
defineProps<{
  open: boolean
  issueLoading: boolean
  issuedCode: string
  issueExpiresAtPreview: string | null
  issueExpireDays: string
  issueExpireTime: string
  issueNote: string
  tenantName: string
  merchantName: string
  branchName: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  issue: []
  close: []
}>()

const { t } = useI18n()

function formatIssueDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)" :ui="{ content: 'sm:max-w-5xl' }">
    <template #content>
      <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('registerCode.issueTitle') }}</h3>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emit('close')" />
          </div>
        </template>

        <div class="space-y-4">
          <div class="grid gap-3 md:grid-cols-3">
            <UFormField :label="t('registerCode.tenant')">
              <UInput
                :model-value="tenantName || '-'"
                class="h-10 w-full"
                readonly
                :ui="{ root: 'w-full', base: 'h-10 w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' }"
              />
            </UFormField>

            <UFormField :label="t('registerCode.merchant')">
              <UInput
                :model-value="merchantName || '-'"
                class="h-10 w-full"
                readonly
                :ui="{ root: 'w-full', base: 'h-10 w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' }"
              />
            </UFormField>

            <UFormField :label="t('registerCode.branch')">
              <UInput
                :model-value="branchName || '-'"
                class="h-10 w-full"
                readonly
                :ui="{ root: 'w-full', base: 'h-10 w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' }"
              />
            </UFormField>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            <UFormField :label="t('registerCode.expireIn')">
              <UInput
                :model-value="`${issueExpireDays} day(s)`"
                class="h-10 w-full"
                readonly
                :ui="{ root: 'w-full', base: 'h-10 w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' }"
              />
            </UFormField>
            <UFormField :label="t('registerCode.expireTime')">
              <UInput
                :model-value="issueExpireTime"
                class="h-10 w-full"
                readonly
                :ui="{ root: 'w-full', base: 'h-10 w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' }"
              />
            </UFormField>
            <UFormField :label="t('registerCode.noteOptional')">
              <UInput
                :model-value="issueNote || '-'"
                class="h-10 w-full"
                readonly
                :ui="{ root: 'w-full', base: 'h-10 w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' }"
              />
            </UFormField>
          </div>
          <p class="text-sm font-semibold text-red-600 dark:text-red-400">
            {{ t('registerCode.expiredAt') }}: {{ formatIssueDate(issueExpiresAtPreview) }}
          </p>

          <div class="grid gap-3 md:grid-cols-1">
            <UFormField :label="t('registerCode.registerCode')">
              <div class="flex items-center gap-2">
                <UInput :model-value="issuedCode || '-'" class="h-10 w-full" readonly :ui="{ base: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono' }" />
                <CopyIconButton :value="issuedCode || ''" :aria-label="t('registerCode.copyCode')" />
              </div>
            </UFormField>
          </div>

        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="emit('close')">{{ t('registerCode.close') }}</UButton>
            <UButton color="primary" class="text-white" :loading="issueLoading" @click="emit('issue')">
              {{ t('registerCode.issue') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
