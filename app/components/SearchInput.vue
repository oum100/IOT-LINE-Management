<script setup lang="ts">
import { computed, ref, watch } from "vue"

type UiMap = Record<string, unknown>

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  icon?: string
  ui?: UiMap
  debounceMs?: number
}>(), {
  modelValue: "",
  placeholder: "Search...",
  icon: "i-lucide-search",
  ui: () => ({}),
  debounceMs: 0,
})

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "input", value: string): void
  (e: "enter"): void
}>()

const localValue = ref(props.modelValue || "")
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (value) => {
  localValue.value = value || ""
})

watch(localValue, (value) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const publish = () => {
    emit("update:modelValue", value)
    emit("input", value)
  }
  if (props.debounceMs > 0) {
    debounceTimer = setTimeout(publish, props.debounceMs)
  } else {
    publish()
  }
})

const mergedUi = computed<UiMap>(() => ({
  base: "h-[40px] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600",
  ...props.ui,
}))
</script>

<template>
  <UInput v-model="localValue" :leading-icon="icon" :placeholder="placeholder" :ui="mergedUi"
    @keyup.enter="emit('enter')" />
</template>
