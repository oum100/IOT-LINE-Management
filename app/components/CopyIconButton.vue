<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  variant?: "solid" | "outline" | "soft" | "subtle" | "ghost" | "link"
  idleColor?: "neutral" | "primary" | "success" | "warning" | "error"
  copiedColor?: "neutral" | "primary" | "success" | "warning" | "error"
  copiedMs?: number
  ariaLabel?: string
}>(), {
  size: "xs",
  variant: "soft",
  idleColor: "neutral",
  copiedColor: "success",
  copiedMs: 1400,
  ariaLabel: "Copy",
})

const emit = defineEmits<{
  copied: []
  error: []
}>()

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function handleCopy() {
  if (!props.value) return
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    emit("copied")
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
    }, props.copiedMs)
  } catch {
    emit("error")
  }
}

onBeforeUnmount(() => {
  if (!copiedTimer) return
  clearTimeout(copiedTimer)
  copiedTimer = null
})
</script>

<template>
  <UButton
    :color="copied ? copiedColor : idleColor"
    :variant="variant"
    :size="size"
    :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
    :ui="{ leadingIcon: 'size-4' }"
    :aria-label="ariaLabel"
    @click="handleCopy"
  />
</template>

