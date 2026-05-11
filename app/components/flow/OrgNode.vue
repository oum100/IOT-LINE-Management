<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data?: {
    label?: string
    compact?: boolean
  }
}>()
</script>

<template>
  <div class="org-node" :class="{ 'org-node--compact': data?.compact }">
    <Handle id="t-top" type="target" :position="Position.Top" />
    <Handle id="t-bottom" type="target" :position="Position.Bottom" />
    <Handle id="s-bottom" type="source" :position="Position.Bottom" />
    <span>{{ data?.label }}</span>
  </div>
</template>

<style scoped>
.org-node {
  min-width: 180px;
  min-height: 76px;
  border-radius: 10px;
  border: 1px solid rgb(148 163 184 / 0.5);
  background: rgb(255 255 255 / 0.95);
  color: rgb(15 23 42);
  white-space: pre-line;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.35;
  padding: 10px 12px;
}

.org-node--compact {
  min-width: 148px;
}

:global(.dark) .org-node {
  border-color: rgb(71 85 105 / 0.8);
  background: rgb(15 23 42 / 0.95);
  color: rgb(241 245 249);
}
</style>
