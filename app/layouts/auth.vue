<template>
  <div class="min-h-screen bg-slate-200 dark:bg-slate-800">
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div class="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div class="flex min-w-[180px] items-center">
          <AppBrandLogo />
        </div>
        <div class="flex min-w-[260px] justify-end">
          <AppHeaderControls :show-sign-in="false" :show-profile="false" />
        </div>
      </div>
    </header>
    <main class="px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
