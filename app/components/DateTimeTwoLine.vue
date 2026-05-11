<script setup lang="ts">
const props = withDefaults(defineProps<{
  value?: string | null
  locale?: string
  emptyLabel?: string
  align?: "left" | "center" | "right"
}>(), {
  value: "",
  locale: undefined,
  emptyLabel: "-",
  align: "left",
})

function dateLabel(value?: string | null) {
  if (!value) return props.emptyLabel
  return new Date(value).toLocaleDateString(props.locale)
}

function timeLabel(value?: string | null) {
  if (!value) return props.emptyLabel
  return new Date(value).toLocaleTimeString(props.locale)
}

const alignClass = computed(() => {
  if (props.align === "center") return "text-center"
  if (props.align === "right") return "text-right"
  return "text-left"
})
</script>

<template>
  <div :class="alignClass">
    <p>{{ dateLabel(value) }}</p>
    <p class="text-xs text-slate-500 dark:text-slate-400">{{ timeLabel(value) }}</p>
  </div>
</template>
