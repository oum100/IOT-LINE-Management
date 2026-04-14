<script setup lang="ts">
const route = useRoute()

const isOrderLayout = computed(() => route.path === '/order')
</script>

<template>
  <div
    class="min-h-screen"
    :class="isOrderLayout ? 'mx-auto max-w-md px-4 py-4 sm:max-w-5xl sm:px-6' : 'mx-auto max-w-none px-0 py-0'"
  >
    <div
      class="overflow-hidden"
      :class="isOrderLayout ? 'line-shell rounded-[2rem] border border-white/70' : ''"
    >
      <header class="border-b border-sky-200/80 bg-gradient-to-r from-sky-500 via-blue-600 to-blue-800 px-5 py-4 text-white">
        <div class="rounded-2xl bg-white/95 px-3 py-2">
          <img
            src="/brand/washpoint-mid.png"
            alt="WashPoint"
            :class="isOrderLayout ? 'mx-auto h-auto w-full max-w-[520px]' : 'h-auto w-full max-w-[380px]'"
          >
        </div>
      </header>
      <main :class="isOrderLayout ? 'min-h-[calc(100vh-96px)] bg-transparent' : 'min-h-[calc(100vh-84px)] bg-transparent'">
        <slot />
      </main>
    </div>
  </div>
</template>
