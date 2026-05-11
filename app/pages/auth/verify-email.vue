<script setup lang="ts">
definePageMeta({
  layout: "auth",
  auth: false,
});

const route = useRoute();
const router = useRouter();

const token = computed(() => String(route.query.token || "").trim());
const loading = ref(false);
const done = ref(false);
const errorMessage = ref("");

async function verifyEmail() {
  errorMessage.value = "";
  if (!token.value) {
    errorMessage.value = "Verification token is missing.";
    return;
  }

  loading.value = true;
  try {
    await $fetch("/api/auth/verify-email", {
      method: "POST",
      body: { token: token.value },
    });
    done.value = true;
  } catch (error: any) {
    errorMessage.value =
      error?.data?.statusMessage || error?.message || "Unable to verify email";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  verifyEmail();
});

function goSignIn() {
  router.push("/auth/signin");
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-140px)] items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
    <UCard
      class="w-full max-w-lg rounded-[24px] shadow-xl shadow-slate-400/15 dark:shadow-slate-950/40"
      :ui="{
        root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200/80 dark:ring-slate-700/80',
        header: 'border-b border-slate-200/70 dark:border-slate-700/70',
      }"
    >
      <template #header>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Verify Email</h1>
      </template>

      <div class="space-y-4">
        <UAlert
          v-if="loading"
          color="info"
          variant="soft"
          icon="i-lucide-loader-circle"
          title="Verifying your email..."
        />
        <UAlert
          v-else-if="done"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle-2"
          title="Your email is verified. You can sign in now."
        />
        <UAlert
          v-else-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          :title="errorMessage"
        />

        <div class="flex gap-3">
          <UButton color="primary" size="lg" class="text-white" @click="goSignIn">
            Go to Sign in
          </UButton>
          <UButton color="neutral" variant="outline" size="lg" @click="verifyEmail" :loading="loading">
            Retry
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
