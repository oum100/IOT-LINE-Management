<script setup lang="ts">
definePageMeta({
  layout: "auth",
  auth: false,
});

const route = useRoute();
const router = useRouter();

const token = computed(() => String(route.query.token || "").trim());
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const loading = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

const isPasswordValid = computed(() =>
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password.value)
);
const isConfirmValid = computed(
  () => password.value.length > 0 && password.value === confirmPassword.value
);
const canSubmit = computed(
  () => token.value.length > 0 && isPasswordValid.value && isConfirmValid.value && !loading.value
);

async function submitResetPassword() {
  successMessage.value = "";
  errorMessage.value = "";

  if (!token.value) {
    errorMessage.value = "Reset token is missing. Please request a new reset link.";
    return;
  }
  if (!isPasswordValid.value) {
    errorMessage.value = "Password must be at least 8 chars, 1 uppercase, 1 number, 1 special.";
    return;
  }
  if (!isConfirmValid.value) {
    errorMessage.value = "Password confirmation does not match.";
    return;
  }

  loading.value = true;
  try {
    await $fetch("/api/auth/reset-password", {
      method: "POST",
      body: {
        token: token.value,
        password: password.value,
        confirmPassword: confirmPassword.value,
      },
    });
    successMessage.value = "Password updated successfully. Redirecting to sign in...";
    setTimeout(() => {
      router.push("/auth/signin");
    }, 900);
  } catch (error: any) {
    errorMessage.value =
      error?.data?.statusMessage || error?.message || "Unable to reset password";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-140px)] items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
    <UCard
      class="w-full max-w-xl rounded-[24px] shadow-xl shadow-slate-400/15 dark:shadow-slate-950/40"
      :ui="{
        root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200/80 dark:ring-slate-700/80',
        header: 'border-b border-slate-200/70 dark:border-slate-700/70',
      }"
    >
      <template #header>
        <h1 class="text-3xl font-bold text-slate-900 dark:text-white">Reset password</h1>
      </template>

      <div class="space-y-4">
        <UAlert
          v-if="!token"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Reset token not found in URL. Please request a new reset link."
        />

        <UFormField label="New password" required class="text-base font-semibold text-slate-800 dark:text-slate-200">
          <UInput
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="New password"
            size="xl"
            color="neutral"
            variant="outline"
            class="w-full"
            :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }"
          >
            <template #trailing>
              <UButton color="neutral" variant="ghost" size="md" class="inline-flex h-9 w-9 items-center justify-center rounded-full p-0" @click="showPassword = !showPassword">
                <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-5" />
              </UButton>
            </template>
          </UInput>
          <template #help>
            <p class="text-xs font-medium text-slate-600 dark:text-slate-400">
              At least 8 chars, 1 Capital, 1 number, 1 special
            </p>
          </template>
        </UFormField>

        <UFormField label="Confirm password" required class="text-base font-semibold text-slate-800 dark:text-slate-200">
          <UInput
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="Confirm password"
            size="xl"
            color="neutral"
            variant="outline"
            class="w-full"
            :ui="{ base: 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600' }"
          >
            <template #trailing>
              <UButton color="neutral" variant="ghost" size="md" class="inline-flex h-9 w-9 items-center justify-center rounded-full p-0" @click="showConfirmPassword = !showConfirmPassword">
                <UIcon :name="showConfirmPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-5" />
              </UButton>
            </template>
          </UInput>
        </UFormField>

        <UAlert
          v-if="successMessage"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle-2"
          :title="successMessage"
        />
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          :title="errorMessage"
        />

        <div class="flex gap-3 pt-2">
          <UButton
            color="primary"
            variant="solid"
            size="lg"
            class="text-white"
            :loading="loading"
            :disabled="!canSubmit"
            @click="submitResetPassword"
          >
            Update password
          </UButton>
          <UButton to="/auth/signin" color="neutral" variant="outline" size="lg">
            Back to Sign in
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
