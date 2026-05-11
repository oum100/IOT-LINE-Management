<script setup lang="ts">
const props = withDefaults(defineProps<{
  showSignIn?: boolean
  showProfile?: boolean
  showSettings?: boolean
  profilePath?: string
  settingsPath?: string
}>(), {
  showSignIn: true,
  showProfile: false,
  showSettings: false,
  profilePath: '/portal',
  settingsPath: '/admin/settings'
})

const { data, signOut } = useAuth()
const { ts } = useI18n()
const router = useRouter()
const dropdownOpen = ref(false)
const isAuthenticated = computed(() => Boolean(data.value?.user))
const profileName = computed(() => data.value?.user?.name || data.value?.user?.email || ts('common.profile'))
const profileImage = computed(() => data.value?.user?.image || undefined)
const avatarKey = computed(() => `${data.value?.user?.id || 'guest'}-${data.value?.user?.provider || 'na'}`)

async function goTo(path: string) {
  dropdownOpen.value = false
  await router.push(path)
}

async function handleSignOut() {
  dropdownOpen.value = false
  await signOut({
    callbackUrl: '/auth/signin'
  })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <LocaleModeControls :hide-locale-on-mobile="false" />
    <UButton
      v-if="props.showSignIn && !isAuthenticated"
      color="primary"
      variant="solid"
      size="sm"
      class="text-white"
      to="/login"
    >
      {{ ts('common.signIn') }}
    </UButton>
    <UPopover
      v-if="props.showProfile && isAuthenticated"
      v-model:open="dropdownOpen"
      :content="{ align: 'end', side: 'bottom', sideOffset: 10 }"
      :ui="{ content: 'p-0 bg-transparent border-0 ring-0 shadow-none rounded-none' }"
    >
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        class="max-w-[250px] rounded-full bg-white px-2.5 py-1.5 text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
      >
        <span class="flex items-center gap-2">
          <UAvatar
            :key="avatarKey"
            :src="profileImage"
            :alt="profileName"
            size="sm"
            class="rounded-full ring-2 ring-white dark:ring-slate-900"
          />
          <span class="max-w-[140px] truncate text-sm font-semibold">{{ profileName }}</span>
          <UIcon name="i-lucide-chevron-down" class="size-4 opacity-70" />
        </span>
      </UButton>

      <template #content>
        <div class="min-w-[190px] space-y-1 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950 p-2 shadow-xl">
          <UButton
            color="neutral"
            variant="ghost"
            block
            class="justify-start text-slate-100 hover:bg-slate-800"
            @click="goTo(props.profilePath)"
          >
            {{ ts('common.profile') }}
          </UButton>
          <UButton
            v-if="props.showSettings"
            color="neutral"
            variant="ghost"
            block
            class="justify-start text-slate-100 hover:bg-slate-800"
            @click="goTo(props.settingsPath)"
          >
            {{ ts('common.settings') }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            block
            class="justify-start text-rose-500 hover:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-800"
            @click="handleSignOut"
          >
            {{ ts('common.signOut') }}
          </UButton>
        </div>
      </template>
    </UPopover>
  </div>
</template>
