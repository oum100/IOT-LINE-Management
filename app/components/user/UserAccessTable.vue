<script setup lang="ts">
const props = withDefaults(defineProps<{
  rows: Array<Record<string, any>>
  columns: Array<Record<string, any>>
  canManageUsers: boolean
  deleteLoadingId?: string
  deleteDisabledIds?: string[]
}>(), {
  deleteLoadingId: '',
  deleteDisabledIds: () => []
})

const emit = defineEmits<{
  edit: [row: Record<string, any>]
  delete: [row: Record<string, any>]
  previewImage: [url: string]
}>()

function onPreviewImage(url?: string | null) {
  if (!url) return
  emit('previewImage', url)
}
</script>

<template>
  <div class="flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
    <UTable :data="rows" :columns="columns" sticky="header" class="user-utable h-full overflow-auto min-w-[1320px] text-sm">
      <template #name-cell="{ row }">
        <span>{{ row.original.name || '-' }}</span>
      </template>
      <template #imageLabel-cell="{ row }">
        <div class="flex justify-center">
          <button
            type="button"
            class="inline-flex rounded-full ring-1 ring-slate-300 transition hover:ring-blue-500 disabled:cursor-default disabled:opacity-80 dark:ring-slate-600 dark:hover:ring-blue-400"
            :disabled="!row.original.image"
            @click="onPreviewImage(row.original.image)"
          >
            <UAvatar :src="row.original.image || undefined" :alt="row.original.name || row.original.email" size="sm" />
          </button>
        </div>
      </template>
      <template #merchantAccountLabel-cell="{ row }">
        <span>{{ row.original.merchantAccountLabel || '-' }}</span>
      </template>
      <template #branchLabel-cell="{ row }">
        <span>{{ row.original.branchLabel || '-' }}</span>
      </template>
      <template #emailVerifiedLabel-cell="{ row }">
        <span class="font-semibold" :class="row.original.emailVerifiedLabel === 'YES' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'">
          {{ row.original.emailVerifiedLabel }}
        </span>
      </template>
      <template #role-cell="{ row }">
        <span>{{ row.original.role }}</span>
      </template>
      <template #isActiveLabel-cell="{ row }">
        <span class="text-sm font-semibold" :class="row.original.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
          {{ row.original.isActiveLabel }}
        </span>
      </template>
      <template #createdAtLabel-cell="{ row }">
        <div class="leading-tight">
          <p class="text-sm text-slate-700 dark:text-slate-200">{{ row.original.createdAtDate }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ row.original.createdAtTime }}</p>
        </div>
      </template>
      <template #updatedAtLabel-cell="{ row }">
        <div class="leading-tight">
          <p class="text-sm text-slate-700 dark:text-slate-200">{{ row.original.updatedAtDate }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ row.original.updatedAtTime }}</p>
        </div>
      </template>
      <template #createdAt-cell="{ row }">
        <div class="leading-tight">
          <p class="text-sm text-slate-700 dark:text-slate-200">{{ row.original.createdAtDate }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ row.original.createdAtTime }}</p>
        </div>
      </template>
      <template #updatedAt-cell="{ row }">
        <div class="leading-tight">
          <p class="text-sm text-slate-700 dark:text-slate-200">{{ row.original.updatedAtDate }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ row.original.updatedAtTime }}</p>
        </div>
      </template>
      <template #actions-cell="{ row }">
        <div v-if="canManageUsers" class="flex items-center justify-center gap-1">
          <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="emit('edit', row.original)" />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            :loading="deleteLoadingId === row.original.id"
            :disabled="deleteDisabledIds.includes(row.original.id)"
            :title="deleteDisabledIds.includes(row.original.id) ? 'This user cannot be deleted.' : 'Delete user'"
            @click="emit('delete', row.original)"
          />
        </div>
        <span v-else class="text-slate-500 dark:text-slate-400">-</span>
      </template>
    </UTable>
  </div>
</template>

<style scoped>
:deep(.user-utable thead) {
  background-color: rgb(30 41 59) !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 30 !important;
}

:deep(.user-utable thead th) {
  color: rgb(203 213 225) !important;
  padding-top: 0.3rem !important;
  padding-bottom: 0.3rem !important;
}

.dark :deep(.user-utable thead) {
  background-color: rgb(15 23 42) !important;
}

.dark :deep(.user-utable thead th) {
  color: rgb(226 232 240) !important;
}

:deep(.user-utable tbody td) {
  padding-top: 0.3rem !important;
  padding-bottom: 0.3rem !important;
}
</style>
