<template>
  <div class="liff-shell min-h-screen bg-slate-200 dark:bg-slate-900">
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div class="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div class="flex min-w-[140px] items-center">
          <AppBrandLogo />
        </div>
        <div class="flex items-center gap-2">
          <LocaleModeControls :hide-locale-on-mobile="false" />
        </div>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
