<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="mx-auto w-full max-w-none px-4 py-8 sm:px-6 lg:px-10">
    <section class="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1.2fr_1fr] lg:p-10">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">{{ t('landing.tagline') }}</p>
        <h1 class="mt-3 text-3xl font-bold leading-tight text-slate-900 dark:text-white sm:text-4xl">
          {{ t('landing.title') }}
        </h1>
        <p class="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
          {{ t('landing.description') }}
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink to="/login" class="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500">
            {{ t('landing.login') }}
          </NuxtLink>
          <NuxtLink to="/signup" class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            {{ t('landing.signup') }}
          </NuxtLink>
        </div>
      </div>
      <div class="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('landing.whatYouGet') }}</h2>
        <ul class="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
          <li>{{ t('landing.featureRealtime') }}</li>
          <li>{{ t('landing.featureHierarchy') }}</li>
          <li>{{ t('landing.featureFirmware') }}</li>
          <li>{{ t('landing.featureNotify') }}</li>
        </ul>
      </div>
    </section>
  </div>
</template>
