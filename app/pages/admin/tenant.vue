<script setup lang="ts">
import { ref } from "vue";

definePageMeta({
  middleware: "portal-auth",
});

type TenantStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
type Tenant = {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  metadata?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
};

type TenantSummary = {
  tenantId: string;
  merchantCount: number;
  branchCount: number;
  assetCount: number;
  deviceCount: number;
  machineCount: number;
  productCount: number;
  paymentCount: number;
  billerCount: number;
  userCount: number;
  orderCount: number;
  totalOrderAmount: number;
};

const loading = ref(false);
const message = ref("");
const error = ref("");
const query = ref("");
const tenants = ref<Tenant[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const selectedTenantId = ref("");
const selectedTenantName = ref("");
const selectedTenantCode = ref("");
const ALL_TENANTS_ID = "all";
const summaryLoading = ref(false);
const summaryError = ref("");
const tenantSummary = ref<TenantSummary | null>(null);
const createOpen = ref(false);
const createForm = ref({
  code: "",
  name: "",
  status: "ACTIVE" as TenantStatus,
});
const metadataOpen = ref(false);
const metadataTitle = ref("");
const metadataRaw = ref("");
const metadataTenantId = ref("");

const editingNameId = ref("");
const nameEditValue = ref("");

const editingStatusId = ref("");
const statusEditValue = ref<TenantStatus>("ACTIVE");
const router = useRouter();
const route = useRoute();
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const hasPrevPage = computed(() => page.value > 1);
const hasNextPage = computed(() => page.value < totalPages.value);

const inputUi = {
  base: "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ring-1 ring-slate-300 dark:ring-slate-600",
};

function setMessage(text: string) {
  message.value = text;
  error.value = "";
}

function setError(err: unknown) {
  const fetchErr = err as { data?: { statusMessage?: string }; message?: string } | undefined;
  const statusMessage = fetchErr?.data?.statusMessage;
  message.value = "";
  error.value = statusMessage || (err instanceof Error ? err.message : "Request failed");
}

async function run(task: () => Promise<void>) {
  loading.value = true;
  try {
    await task();
  } catch (err) {
    setError(err);
  } finally {
    loading.value = false;
  }
}

async function loadTenants() {
  await run(async () => {
    const response = await $fetch<{ items: Tenant[]; total: number; page: number; pageSize: number }>("/api/admin/tenants", {
      query: {
        ...(query.value ? { q: query.value } : {}),
        page: page.value,
        pageSize: pageSize.value,
      },
    });
    tenants.value = response.items || [];
    total.value = Number(response.total || 0);
    page.value = Number(response.page || page.value);
    pageSize.value = Number(response.pageSize || pageSize.value);

    const stillExists = selectedTenantId.value === ALL_TENANTS_ID
      || tenants.value.some(item => item.id === selectedTenantId.value);
    if (!stillExists) {
      await selectAllTenants();
    }
  });
}

async function loadTenantSummary(tenantId: string) {
  summaryLoading.value = true;
  summaryError.value = "";
  try {
    tenantSummary.value = await $fetch<TenantSummary>(`/api/admin/tenants/${tenantId}/summary`);
  } catch (err) {
    tenantSummary.value = null;
    summaryError.value = err instanceof Error ? err.message : "Failed to load tenant summary";
  } finally {
    summaryLoading.value = false;
  }
}

async function selectTenant(item: Tenant) {
  selectedTenantId.value = item.id;
  selectedTenantName.value = item.name;
  selectedTenantCode.value = item.code;
  await loadTenantSummary(item.id);
}

async function selectAllTenants() {
  selectedTenantId.value = ALL_TENANTS_ID;
  selectedTenantName.value = "Tenant quick view";
  selectedTenantCode.value = "";
  await loadTenantSummary(ALL_TENANTS_ID);
}

async function onTenantSummaryChange() {
  if (selectedTenantId.value === ALL_TENANTS_ID) {
    await selectAllTenants();
    return;
  }
  const tenant = tenants.value.find(item => item.id === selectedTenantId.value);
  if (!tenant) {
    await selectAllTenants();
    return;
  }
  await selectTenant(tenant);
}

function startEditName(item: Tenant) {
  editingNameId.value = item.id;
  nameEditValue.value = item.name;
}

function cancelEditName() {
  editingNameId.value = "";
  nameEditValue.value = "";
}

async function saveName(item: Tenant) {
  await run(async () => {
    const name = (nameEditValue.value || "").trim();
    if (!name) {
      throw new Error("Tenant name is required.");
    }

    await $fetch(`/api/admin/tenants/${item.id}`, {
      method: "PATCH",
      body: {
        name,
      },
    });

    setMessage(`Tenant name updated: ${item.code}`);
    cancelEditName();
    await loadTenants();
  });
}

function startEditStatus(item: Tenant) {
  editingStatusId.value = item.id;
  statusEditValue.value = item.status;
}

function cancelEditStatus() {
  editingStatusId.value = "";
}

async function saveStatus(item: Tenant) {
  await run(async () => {
    await $fetch(`/api/admin/tenants/${item.id}`, {
      method: "PATCH",
      body: {
        status: statusEditValue.value,
      },
    });

    setMessage(`Tenant status updated: ${item.code}`);
    cancelEditStatus();
    await loadTenants();
  });
}

async function deleteTenant(item: Tenant) {
  const expectedName = item.name.trim();
  const typed = window.prompt(`Type tenant name to confirm delete:\n${expectedName}`, "");
  if (typed === null) return;
  if (typed.trim() !== expectedName) {
    setError(new Error("Tenant name does not match. Delete cancelled."));
    return;
  }

  await run(async () => {
    await $fetch(`/api/admin/tenants/${item.id}`, {
      method: "DELETE",
      body: {
        confirmText: "DELETE",
        confirmName: expectedName,
      },
    });

    setMessage(`Tenant deleted: ${item.code}`);
    if (selectedTenantId.value === item.id) {
      await selectAllTenants();
    }
    await loadTenants();
  });
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatMetadata(value: unknown) {
  if (!value) return "";
  const raw = JSON.stringify(value);
  return raw.length > 80 ? `${raw.slice(0, 80)}...` : raw;
}

function formatMoney(value?: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

type TenantArea =
  | "sales"
  | "merchant"
  | "branch"
  | "asset"
  | "device"
  | "machine"
  | "product"
  | "payment"
  | "biller"
  | "user"
  | "order";

async function goToTenantDetail(tenantId: string) {
  if (!tenantId) return;
  await navigateTo(`/admin/tenant/${tenantId}`);
}

async function goToTenantArea(area: TenantArea, tenantId = selectedTenantId.value) {
  const isAll = !tenantId || tenantId === ALL_TENANTS_ID;
  if (area === "merchant") {
    await navigateTo(isAll ? "/admin/merchants" : `/admin/merchants?tenantId=${tenantId}`);
    return;
  }
  if (area === "branch") {
    await navigateTo(isAll ? "/admin/branchs" : `/admin/branchs?tenantId=${tenantId}`);
    return;
  }
  if (area === "asset") {
    await navigateTo(isAll ? "/admin/assets" : `/admin/assets?tenantId=${tenantId}`);
    return;
  }
  if (area === "payment") {
    await navigateTo(isAll ? "/admin/ops" : `/admin/ops?tenantId=${tenantId}`);
    return;
  }
  if (area === "machine" || area === "product") {
    setMessage(`ส่วน ${area} จะทำหน้าใหม่ภายหลัง`);
    return;
  }
  if (area === "biller") {
    await navigateTo(isAll ? "/admin/ops" : `/admin/ops?tenantId=${tenantId}`);
    return;
  }
  setMessage(`ส่วน ${area} ปิดไว้ก่อน จะทำหน้าใหม่ภายหลัง`);
}

async function suggestNextTenantCode() {
  const collected: Tenant[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const response = await $fetch<{ items: Tenant[] }>("/api/admin/tenants", {
      query: { page, pageSize },
    });
    const items = response.items || [];
    collected.push(...items);
    if (items.length < pageSize) break;
    page += 1;
    if (page > 50) break;
  }

  const maxCodeNumber = collected.reduce((max, tenant) => {
    const match = tenant.code?.match(/^TN-(\d{5})$/i);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  const next = String(maxCodeNumber + 1).padStart(5, "0");
  return `TN-${next}`;
}

async function openCreateDialog() {
  await run(async () => {
    createForm.value = {
      code: await suggestNextTenantCode(),
      name: "",
      status: "ACTIVE",
    };
    createOpen.value = true;
  });
}

function closeCreateDialog() {
  createOpen.value = false;
}

async function goToPage(target: number) {
  const next = Math.min(Math.max(1, target), totalPages.value);
  if (next === page.value) return;
  page.value = next;
  await loadTenants();
}

async function onSearch() {
  page.value = 1;
  await loadTenants();
}

async function createTenant() {
  await run(async () => {
    const code = (createForm.value.code || "").trim().toUpperCase();
    const name = (createForm.value.name || "").trim();
    if (!code) throw new Error("Tenant code is required.");
    if (!name) throw new Error("Tenant name is required.");
    if (!/^TN-\d{5}$/.test(code)) {
      throw new Error("Tenant code must be format TN-00001.");
    }

    await $fetch("/api/admin/tenants", {
      method: "POST",
      body: {
        code,
        name,
        status: createForm.value.status,
      },
    });

    setMessage(`Tenant created: ${code}`);
    closeCreateDialog();
    await loadTenants();
  });
}

function openMetadata(item: Tenant) {
  metadataTitle.value = `${item.code} details`;
  metadataTenantId.value = item.id;
  metadataRaw.value = item.metadata
    ? JSON.stringify(item.metadata, null, 2)
    : "{}";
  metadataOpen.value = true;
}

async function saveMetadata() {
  await run(async () => {
    if (!metadataTenantId.value) {
      throw new Error("Missing tenant id.");
    }

    let parsed: Record<string, any> | null = null;
    const raw = metadataRaw.value.trim();
    if (raw) {
      parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Details must be a JSON object.");
      }
    }

    await $fetch(`/api/admin/tenants/${metadataTenantId.value}`, {
      method: "PATCH",
      body: {
        metadata: parsed || {},
      },
    });

    metadataOpen.value = false;
    setMessage("Tenant details updated.");
    await loadTenants();
  });
}

onMounted(async () => {
  await selectAllTenants();
  await loadTenants();
  if (String(route.query.create || "") === "1") {
    await openCreateDialog();
    await router.replace({ path: "/admin/tenant" });
  }
});
</script>

<template>
  <section class="space-y-4 text-sm text-slate-900 dark:text-slate-100">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Tenant Management</h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Tenant list only: code is locked, name editable, status active/inactive, delete disabled.
        </p>
      </div>
      <button
        type="button"
        class="rounded-md border border-emerald-300/40 bg-emerald-50/60 px-5 py-3 text-center transition hover:bg-emerald-100/70 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:hover:bg-emerald-800/25"
        @click="goToTenantArea('sales')"
      >
        <div class="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-200">
          <UIcon name="i-lucide-badge-dollar-sign" class="size-4 text-emerald-700/90 dark:text-emerald-300" />
          <span class="text-sm font-semibold text-emerald-700/90 dark:text-emerald-300">Revenue</span>
          <span class="text-xl font-bold">{{ formatMoney(tenantSummary?.totalOrderAmount) }}</span>
        </div>
      </button>
    </div>

    <UAlert
      v-if="message"
      color="success"
      variant="soft"
      icon="i-lucide-check-circle-2"
      :title="message"
    />
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      :title="error"
    />

    <UCard
      v-if="selectedTenantId"
      :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }"
    >
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ selectedTenantCode ? `${selectedTenantName} (${selectedTenantCode})` : selectedTenantName }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Tenant related counters</p>
          </div>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="summaryLoading"
            @click="loadTenantSummary(selectedTenantId)"
          >
            Refresh
          </UButton>
        </div>
      </template>

      <UAlert
        v-if="summaryError"
        color="error"
        variant="soft"
        icon="i-lucide-alert-triangle"
        :title="summaryError"
        class="mb-3"
      />

      <div v-if="summaryLoading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading summary...
      </div>

      <div v-else-if="tenantSummary" class="overflow-x-auto">
        <div class="grid min-w-[1220px] grid-cols-10 gap-1">
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('merchant')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-store" class="size-4" />
              <span>Merchant</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.merchantCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('branch')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-building-2" class="size-4" />
              <span>Branch</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.branchCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('asset')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-package" class="size-4" />
              <span>Asset</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.assetCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('device')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-cpu" class="size-4" />
              <span>Device</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.deviceCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('machine')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-cog" class="size-4" />
              <span>Machine</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.machineCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('product')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-box" class="size-4" />
              <span>Product</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.productCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('order')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-shopping-cart" class="size-4" />
              <span>Order</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.orderCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('payment')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-wallet" class="size-4" />
              <span>Payment</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.paymentCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('biller')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-receipt-text" class="size-4" />
              <span>Biller</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.billerCount }}</p>
          </button>
          <button type="button" class="rounded-md border border-slate-200 bg-white px-2 py-2 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70" @click="goToTenantArea('user')">
            <p class="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-users" class="size-4" />
              <span>User</span>
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ tenantSummary.userCount }}</p>
          </button>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ root: 'bg-white/95 dark:bg-slate-900/90 ring-1 ring-slate-200 dark:ring-slate-700' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Tenant List</h2>
          <div class="flex items-center gap-2">
            <select
              v-model="selectedTenantId"
              class="w-[260px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              @change="onTenantSummaryChange"
            >
              <option :value="ALL_TENANTS_ID">All tenants</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                {{ tenant.name }}
              </option>
            </select>
            <SearchInput
              v-model="query"
              placeholder="Search tenant..."
              class="w-[320px]"
              @enter="onSearch"
            />
            <UButton
              color="primary"
              icon="i-lucide-plus"
              class="text-white"
              @click="openCreateDialog"
            >
              Create
            </UButton>
          </div>
        </div>
      </template>

      <div class="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table class="w-full min-w-[1260px] text-sm">
          <thead class="bg-slate-100/70 dark:bg-slate-800/70">
            <tr class="text-left">
              <th class="px-3 py-2">code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Details</th>
              <th class="px-3 py-2">createdAt</th>
              <th class="px-3 py-2">updatedAt</th>
              <th class="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in tenants"
              :key="item.id"
              class="cursor-pointer border-t border-slate-200 transition-colors duration-150 dark:border-slate-800"
              :class="selectedTenantId === item.id
                ? 'bg-blue-100/80 text-slate-900 hover:bg-blue-200/80 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-700/80'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'"
              @click="selectTenant(item)"
            >
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <span class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {{ item.code }}
                  </span>
                  <CopyIconButton :value="item.code" aria-label="Copy tenant code" />
                </div>
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <template v-if="editingNameId === item.id">
                    <UInput
                      v-model="nameEditValue"
                      placeholder="Tenant name"
                      class="w-full"
                      :ui="inputUi"
                    />
                    <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="loading" @click="saveName(item)" />
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEditName" />
                  </template>
                  <template v-else>
                    <span class="truncate">{{ item.name }}</span>
                    <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click="startEditName(item)" />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <template v-if="editingStatusId === item.id">
                    <select
                      v-model="statusEditValue"
                      class="w-[140px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                    <UButton size="xs" color="primary" icon="i-lucide-check" class="text-white" :loading="loading" @click="saveStatus(item)" />
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEditStatus" />
                  </template>
                  <template v-else>
                    <span class="text-xs font-semibold" :class="item.status === 'ACTIVE' ? 'text-emerald-600' : item.status === 'SUSPENDED' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'">
                      {{ item.status }}
                    </span>
                    <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-pencil" @click="startEditStatus(item)" />
                  </template>
                </div>
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <code v-if="item.metadata" class="text-xs text-slate-600 dark:text-slate-300">{{ formatMetadata(item.metadata) }}</code>
                  <UButton
                    v-if="item.metadata"
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-info"
                    class="font-semibold text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    @click="openMetadata(item)"
                  >
                    Details
                  </UButton>
                  <UButton
                    v-else
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-plus"
                    class="font-semibold text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    @click="openMetadata(item)"
                  >
                    Add Details
                  </UButton>
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                <DateTimeTwoLine :value="item.createdAt" />
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                <DateTimeTwoLine :value="item.updatedAt" />
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-1">
                  <UButton title="Open tenant details" size="xs" color="primary" variant="soft" class="text-blue-700 dark:text-blue-200 ring-blue-300/70 dark:ring-blue-700/60 hover:bg-blue-100 dark:hover:bg-blue-900/30" icon="i-lucide-eye" @click.stop="goToTenantDetail(item.id)" />
                  <UButton title="Open merchants" size="xs" color="neutral" variant="soft" class="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" icon="i-lucide-store" @click.stop="goToTenantArea('merchant', item.id)" />
                  <UButton title="Open branches" size="xs" color="neutral" variant="soft" class="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" icon="i-lucide-building-2" @click.stop="goToTenantArea('branch', item.id)" />
                  <UButton title="Open assets" size="xs" color="neutral" variant="soft" class="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" icon="i-lucide-package" @click.stop="goToTenantArea('asset', item.id)" />
                  <UButton title="Open devices" size="xs" color="neutral" variant="soft" class="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" icon="i-lucide-cpu" @click.stop="goToTenantArea('device', item.id)" />
                  <UButton title="Open users" size="xs" color="neutral" variant="soft" class="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" icon="i-lucide-users" @click.stop="goToTenantArea('user', item.id)" />
                  <UButton title="Open orders" size="xs" color="neutral" variant="soft" class="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" icon="i-lucide-shopping-cart" @click.stop="goToTenantArea('order', item.id)" />
                  <UButton title="Delete tenant" size="xs" color="error" variant="soft" class="text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30" icon="i-lucide-trash-2" @click.stop="deleteTenant(item)" />
                </div>
              </td>
            </tr>
            <tr v-if="tenants.length === 0">
              <td colspan="7" class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No tenants found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Showing {{ tenants.length }} of {{ total }} tenants
        </p>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-chevrons-left"
            :disabled="!hasPrevPage || loading"
            @click="goToPage(1)"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-chevron-left"
            :disabled="!hasPrevPage || loading"
            @click="goToPage(page - 1)"
          />
          <span class="px-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            Page {{ page }} / {{ totalPages }}
          </span>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-chevron-right"
            :disabled="!hasNextPage || loading"
            @click="goToPage(page + 1)"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-chevrons-right"
            :disabled="!hasNextPage || loading"
            @click="goToPage(totalPages)"
          />
        </div>
      </div>
    </UCard>

    <UModal v-model:open="createOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Create Tenant</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="closeCreateDialog" />
            </div>
          </template>

          <div class="space-y-3">
            <UFormField label="Code">
              <UInput
                v-model="createForm.code"
                placeholder="TN-00001"
                :ui="inputUi"
              />
            </UFormField>

            <UFormField label="Name">
              <UInput
                v-model="createForm.name"
                placeholder="Tenant name"
                :ui="inputUi"
              />
            </UFormField>

            <UFormField label="Status">
              <select
                v-model="createForm.status"
                class="w-[160px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" class="text-slate-700 dark:text-slate-100" @click="closeCreateDialog">
                Cancel
              </UButton>
              <UButton color="primary" class="text-white" :loading="loading" @click="createTenant">
                Create Tenant
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="metadataOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard :ui="{ root: 'bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ metadataTitle }}</h3>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="metadataOpen = false" />
            </div>
          </template>

          <textarea
            v-model="metadataRaw"
            rows="14"
            class="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700 outline-none ring-primary/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500"
            placeholder="{ &quot;ownerName&quot;: &quot;Washpoint HQ&quot;, &quot;note&quot;: &quot;optional&quot; }"
          />

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" class="text-slate-700 dark:text-slate-100" @click="metadataOpen = false">
                Cancel
              </UButton>
              <UButton color="primary" class="text-white" :loading="loading" @click="saveMetadata">
                Save Details
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>
