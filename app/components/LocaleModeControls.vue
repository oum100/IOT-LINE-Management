<script setup lang="ts">
const props = withDefaults(defineProps<{
  showLocale?: boolean
  hideLocaleOnMobile?: boolean
}>(), {
  showLocale: true,
  hideLocaleOnMobile: true
})

const { getLocales, getLocale, switchLocale } = useI18n()
const colorMode = useColorMode()

const localeOptions = computed(() => getLocales().map(locale => ({
  code: locale.code,
  label: String(locale.name || locale.code.toUpperCase())
})))

const currentLocale = computed(() => getLocale())
const currentLocaleLabel = computed(() =>
  localeOptions.value.find(item => item.code === currentLocale.value)?.label || currentLocale.value.toUpperCase()
)
const localeOpen = ref(false)
const localeGroupClass = computed(() =>
  props.hideLocaleOnMobile
    ? 'hidden sm:block'
    : 'block'
)

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

function selectLocale(code: string) {
  localeOpen.value = false
  switchLocale(code)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <UPopover
      v-if="props.showLocale"
      v-model:open="localeOpen"
      :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
      :ui="{ content: 'p-0 bg-transparent border-0 ring-0 shadow-none rounded-none' }"
      :class="localeGroupClass"
    >
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        class="min-w-[98px] justify-between bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <span class="truncate">{{ currentLocaleLabel }}</span>
        <UIcon name="i-lucide-chevron-down" class="size-4 opacity-70" />
      </UButton>
      <template #content>
        <div class="w-[150px] space-y-1 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950 p-2 shadow-xl">
          <UButton
            v-for="item in localeOptions"
            :key="item.code"
            color="neutral"
            variant="ghost"
            block
            class="justify-start text-slate-100 hover:bg-slate-800"
            :class="currentLocale === item.code ? 'bg-slate-800 font-semibold' : ''"
            @click="selectLocale(item.code)"
          >
            {{ item.label }}
          </UButton>
        </div>
      </template>
    </UPopover>

    <UButton
      color="neutral"
      variant="soft"
      size="sm"
      class="text-slate-700 dark:text-slate-100"
      @click="toggleTheme"
    >
      <UIcon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" class="size-5" />
    </UButton>
  </div>
</template>
