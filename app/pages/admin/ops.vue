<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

type Tenant = { id: string; code: string; name: string; status: string }
type Merchant = { id: string; code: string; name: string; status: string; environment: string }
type Branch = { id: string; code: string; name: string; status: string; merchantAccountId?: string | null }
type Asset = { id: string; assetUuid: string; code: string; name: string; kind: string; status: string }
type Machine = { id: string; code: string; name: string; kind: string; status: string; locationLabel: string }
type Device = { id: string; macAddress: string; deviceUid?: string | null; fwVersion?: string | null }
type UserRow = { id: string; email: string; name?: string | null; role: 'ADMIN' | 'USER'; isActive: boolean }
type RegistrationCode = { id: string; code: string; status: string; expiresAt?: string | null; plainCode?: string }
type DeviceKey = { id: string; keyPrefix: string; status: string; expiresAt?: string | null; plainKey?: string }

const adminKey = ref('')
const loading = ref(false)
const message = ref('')
const error = ref('')

const tenants = ref<Tenant[]>([])
const merchants = ref<Merchant[]>([])
const branches = ref<Branch[]>([])
const assets = ref<Asset[]>([])
const machines = ref<Machine[]>([])
const devices = ref<Device[]>([])
const users = ref<UserRow[]>([])
const registrationCodes = ref<RegistrationCode[]>([])
const deviceKeys = ref<DeviceKey[]>([])

const selectedTenantId = ref('')
const selectedMerchantId = ref('')
const selectedBranchId = ref('')
const selectedDeviceId = ref('')

const newTenant = ref({ code: '', name: '' })
const newMerchant = ref({ code: '', name: '' })
const newBranch = ref({ code: '', name: '' })
const newAsset = ref({ assetUuid: '', code: '', name: '', kind: 'WASHER' as 'WASHER' | 'DRYER' })
const newMachine = ref({ code: '', name: '', kind: 'WASHER' as 'WASHER' | 'DRYER', locationLabel: '' })
const newDevice = ref({ macAddress: '', deviceUid: '', fwVersion: '' })
const newAdminUser = ref({ email: '', password: '', name: '' })

const newRegistrationCode = ref({ expiresAt: '', note: '' })
const newDeviceKey = ref({ expiresAt: '', label: '' })

const registerTest = ref({
  registrationCode: '',
  macAddress: '',
  deviceUid: '',
  fwVersion: '',
  machineSerialNo: '',
  machineName: '',
  machineKind: 'WASHER' as 'WASHER' | 'DRYER',
  machineCode: '',
  locationLabel: ''
})
const registerResult = ref<any>(null)

function headers() {
  return adminKey.value ? { 'x-admin-key': adminKey.value } : undefined
}

function setMessage(text: string) {
  message.value = text
  error.value = ''
}

function setError(err: unknown) {
  message.value = ''
  error.value = err instanceof Error ? err.message : 'Request failed'
}

async function run(task: () => Promise<void>) {
  loading.value = true
  try {
    await task()
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

async function loadTenants() {
  const response = await $fetch<{ items: Tenant[] }>('/api/admin/tenants', {
    headers: headers()
  })
  tenants.value = response.items || []
  if (!selectedTenantId.value && tenants.value.length) {
    selectedTenantId.value = tenants.value[0]!.id
  }
}

async function loadMerchants() {
  if (!selectedTenantId.value) {
    merchants.value = []
    return
  }
  const response = await $fetch<{ items: Merchant[] }>('/api/admin/merchants', {
    query: { tenantId: selectedTenantId.value },
    headers: headers()
  })
  merchants.value = response.items || []
  if (!merchants.value.find(item => item.id === selectedMerchantId.value)) {
    selectedMerchantId.value = merchants.value[0]?.id || ''
  }
}

async function loadBranches() {
  if (!selectedTenantId.value) {
    branches.value = []
    return
  }
  const response = await $fetch<{ items: Branch[] }>('/api/admin/branches', {
    query: {
      tenantId: selectedTenantId.value,
      ...(selectedMerchantId.value ? { merchantAccountId: selectedMerchantId.value } : {})
    },
    headers: headers()
  })
  branches.value = response.items || []
  if (!branches.value.find(item => item.id === selectedBranchId.value)) {
    selectedBranchId.value = branches.value[0]?.id || ''
  }
}

async function loadAssets() {
  if (!selectedTenantId.value) {
    assets.value = []
    return
  }
  const response = await $fetch<{ items: Asset[] }>('/api/admin/assets', {
    query: {
      tenantId: selectedTenantId.value,
      ...(selectedBranchId.value ? { branchId: selectedBranchId.value } : {})
    },
    headers: headers()
  })
  assets.value = response.items || []
}

async function loadMachines() {
  if (!selectedTenantId.value) {
    machines.value = []
    return
  }
  const response = await $fetch<{ items: Machine[] }>('/api/admin/machines', {
    query: {
      tenantId: selectedTenantId.value,
      ...(selectedMerchantId.value ? { merchantAccountId: selectedMerchantId.value } : {}),
      ...(selectedBranchId.value ? { branchId: selectedBranchId.value } : {})
    },
    headers: headers()
  })
  machines.value = response.items || []
}

async function loadDevices() {
  if (!selectedTenantId.value) {
    devices.value = []
    return
  }
  const response = await $fetch<{ items: Device[] }>('/api/admin/devices', {
    query: { tenantId: selectedTenantId.value },
    headers: headers()
  })
  devices.value = response.items || []
  if (!devices.value.find(item => item.id === selectedDeviceId.value)) {
    selectedDeviceId.value = devices.value[0]?.id || ''
  }
}

async function loadUsers() {
  if (!selectedTenantId.value) {
    users.value = []
    return
  }
  const response = await $fetch<{ items: UserRow[] }>('/api/admin/users', {
    query: { tenantId: selectedTenantId.value },
    headers: headers()
  })
  users.value = response.items || []
}

async function loadRegistrationCodes() {
  if (!selectedTenantId.value) {
    registrationCodes.value = []
    return
  }
  const response = await $fetch<{ items: RegistrationCode[] }>('/api/admin/device-registration-codes', {
    query: {
      tenantId: selectedTenantId.value,
      ...(selectedMerchantId.value ? { merchantAccountId: selectedMerchantId.value } : {}),
      ...(selectedBranchId.value ? { branchId: selectedBranchId.value } : {})
    },
    headers: headers()
  })
  registrationCodes.value = response.items || []
}

async function loadDeviceKeys() {
  if (!selectedDeviceId.value) {
    deviceKeys.value = []
    return
  }
  deviceKeys.value = await $fetch<DeviceKey[]>('/api/admin/device-keys', {
    query: { iotDeviceId: selectedDeviceId.value },
    headers: headers()
  })
}

async function reloadAll() {
  await loadTenants()
  await loadMerchants()
  await loadBranches()
  await loadAssets()
  await loadMachines()
  await loadDevices()
  await loadUsers()
  await loadRegistrationCodes()
  await loadDeviceKeys()
}

watch(selectedTenantId, async () => {
  await run(async () => {
    await loadMerchants()
    await loadBranches()
    await loadAssets()
    await loadMachines()
    await loadDevices()
    await loadUsers()
    await loadRegistrationCodes()
    await loadDeviceKeys()
  })
})

watch([selectedMerchantId, selectedBranchId], async () => {
  await run(async () => {
    await loadBranches()
    await loadAssets()
    await loadMachines()
    await loadRegistrationCodes()
  })
})

watch(selectedDeviceId, async () => {
  await run(async () => {
    await loadDeviceKeys()
  })
})

async function createTenant() {
  await run(async () => {
    const created = await $fetch<Tenant>('/api/admin/tenants', {
      method: 'POST',
      headers: headers(),
      body: newTenant.value
    })
    selectedTenantId.value = created.id
    newTenant.value = { code: '', name: '' }
    await reloadAll()
    setMessage(`Tenant ${created.code} created`)
  })
}

async function createMerchant() {
  if (!selectedTenantId.value) return
  await run(async () => {
    const created = await $fetch<Merchant>('/api/admin/merchants', {
      method: 'POST',
      headers: headers(),
      body: {
        tenantId: selectedTenantId.value,
        code: newMerchant.value.code,
        name: newMerchant.value.name
      }
    })
    selectedMerchantId.value = created.id
    newMerchant.value = { code: '', name: '' }
    await reloadAll()
    setMessage(`Merchant ${created.code} created`)
  })
}

async function createBranch() {
  if (!selectedTenantId.value) return
  await run(async () => {
    const created = await $fetch<Branch>('/api/admin/branches', {
      method: 'POST',
      headers: headers(),
      body: {
        tenantId: selectedTenantId.value,
        merchantAccountId: selectedMerchantId.value || null,
        code: newBranch.value.code,
        name: newBranch.value.name
      }
    })
    selectedBranchId.value = created.id
    newBranch.value = { code: '', name: '' }
    await reloadAll()
    setMessage(`Branch ${created.code} created`)
  })
}

async function createAsset() {
  if (!selectedTenantId.value || !selectedBranchId.value) return
  await run(async () => {
    const created = await $fetch<Asset>('/api/admin/assets', {
      method: 'POST',
      headers: headers(),
      body: {
        tenantId: selectedTenantId.value,
        branchId: selectedBranchId.value,
        assetUuid: newAsset.value.assetUuid || `ASSET-${Date.now()}`,
        code: newAsset.value.code,
        name: newAsset.value.name,
        kind: newAsset.value.kind
      }
    })
    newAsset.value = { assetUuid: '', code: '', name: '', kind: 'WASHER' }
    await reloadAll()
    setMessage(`Asset ${created.code} created`)
  })
}

async function createMachine() {
  if (!selectedTenantId.value) return
  await run(async () => {
    const created = await $fetch<Machine>('/api/admin/machines', {
      method: 'POST',
      headers: headers(),
      body: {
        tenantId: selectedTenantId.value,
        merchantAccountId: selectedMerchantId.value || null,
        branchId: selectedBranchId.value || null,
        code: newMachine.value.code,
        name: newMachine.value.name,
        kind: newMachine.value.kind,
        locationLabel: newMachine.value.locationLabel || 'Default'
      }
    })
    newMachine.value = { code: '', name: '', kind: 'WASHER', locationLabel: '' }
    await reloadAll()
    setMessage(`Machine ${created.code} created`)
  })
}

async function createDevice() {
  if (!selectedTenantId.value) return
  await run(async () => {
    const created = await $fetch<Device>('/api/admin/devices', {
      method: 'POST',
      headers: headers(),
      body: {
        tenantId: selectedTenantId.value,
        macAddress: newDevice.value.macAddress,
        deviceUid: newDevice.value.deviceUid || null,
        fwVersion: newDevice.value.fwVersion || null
      }
    })
    selectedDeviceId.value = created.id
    newDevice.value = { macAddress: '', deviceUid: '', fwVersion: '' }
    await reloadAll()
    setMessage(`Device ${created.macAddress} created`)
  })
}

async function bootstrapAdmin() {
  await run(async () => {
    await $fetch('/api/admin/users/bootstrap', {
      method: 'POST',
      headers: headers(),
      body: {
        email: newAdminUser.value.email,
        password: newAdminUser.value.password,
        name: newAdminUser.value.name,
        tenantId: selectedTenantId.value || null,
        merchantAccountId: selectedMerchantId.value || null
      }
    })
    newAdminUser.value = { email: '', password: '', name: '' }
    await loadUsers()
    setMessage('Admin user created/updated')
  })
}

async function createRegistrationCode() {
  if (!selectedTenantId.value) return
  await run(async () => {
    const created = await $fetch<RegistrationCode>('/api/admin/device-registration-codes', {
      method: 'POST',
      headers: headers(),
      body: {
        tenantId: selectedTenantId.value,
        merchantAccountId: selectedMerchantId.value || null,
        branchId: selectedBranchId.value || null,
        expiresAt: newRegistrationCode.value.expiresAt || undefined,
        note: newRegistrationCode.value.note || undefined
      }
    })
    newRegistrationCode.value = { expiresAt: '', note: '' }
    await loadRegistrationCodes()
    setMessage(`Registration code created: ${created.plainCode || created.code}`)
  })
}

async function createDeviceKey() {
  if (!selectedDeviceId.value) return
  await run(async () => {
    const created = await $fetch<DeviceKey>('/api/admin/device-keys', {
      method: 'POST',
      headers: headers(),
      body: {
        iotDeviceId: selectedDeviceId.value,
        expiresAt: newDeviceKey.value.expiresAt || undefined,
        label: newDeviceKey.value.label || undefined
      }
    })
    newDeviceKey.value = { expiresAt: '', label: '' }
    await loadDeviceKeys()
    setMessage(`Device key created: ${created.plainKey || created.keyPrefix}`)
  })
}

async function deleteBy(path: string, id: string, done: () => Promise<void>) {
  await run(async () => {
    await $fetch(`${path}/${id}`, {
      method: 'DELETE',
      headers: headers()
    })
    await done()
    setMessage('Deleted')
  })
}

async function patchBy(path: string, id: string, body: Record<string, unknown>, done: () => Promise<void>, successText = 'Updated') {
  await run(async () => {
    await $fetch(`${path}/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body
    })
    await done()
    setMessage(successText)
  })
}

function ask(label: string, currentValue = '') {
  if (!import.meta.client) return null
  const value = window.prompt(label, currentValue)
  if (value === null) return null
  return value.trim()
}

function pickEnum<T extends string>(value: string, allowed: readonly T[], fallback: T) {
  const normalized = value.toUpperCase() as T
  return allowed.includes(normalized) ? normalized : fallback
}

async function editTenant(item: Tenant) {
  const name = ask('Tenant name', item.name)
  if (name === null) return
  const statusRaw = ask('Status: ACTIVE | SUSPENDED | DISABLED', item.status)
  if (statusRaw === null) return
  const status = pickEnum(statusRaw, ['ACTIVE', 'SUSPENDED', 'DISABLED'] as const, item.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED')
  await patchBy('/api/admin/tenants', item.id, { name: name || item.name, status }, reloadAll, 'Tenant updated')
}

async function editMerchant(item: Merchant) {
  const name = ask('Merchant name', item.name)
  if (name === null) return
  const statusRaw = ask('Status: ACTIVE | SUSPENDED | DISABLED', item.status)
  if (statusRaw === null) return
  const envRaw = ask('Environment: TEST | LIVE', item.environment)
  if (envRaw === null) return
  const status = pickEnum(statusRaw, ['ACTIVE', 'SUSPENDED', 'DISABLED'] as const, item.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED')
  const environment = pickEnum(envRaw, ['TEST', 'LIVE'] as const, item.environment as 'TEST' | 'LIVE')
  await patchBy('/api/admin/merchants', item.id, { name: name || item.name, status, environment }, reloadAll, 'Merchant updated')
}

async function editBranch(item: Branch) {
  const name = ask('Branch name', item.name)
  if (name === null) return
  const statusRaw = ask('Status: ACTIVE | INACTIVE | DISABLED', item.status)
  if (statusRaw === null) return
  const status = pickEnum(statusRaw, ['ACTIVE', 'INACTIVE', 'DISABLED'] as const, item.status as 'ACTIVE' | 'INACTIVE' | 'DISABLED')
  await patchBy('/api/admin/branches', item.id, { name: name || item.name, status }, reloadAll, 'Branch updated')
}

async function editAsset(item: Asset) {
  const name = ask('Asset name', item.name)
  if (name === null) return
  const kindRaw = ask('Kind: WASHER | DRYER', item.kind)
  if (kindRaw === null) return
  const statusRaw = ask('Status: ACTIVE | INACTIVE | MAINTENANCE', item.status)
  if (statusRaw === null) return
  const kind = pickEnum(kindRaw, ['WASHER', 'DRYER'] as const, item.kind as 'WASHER' | 'DRYER')
  const status = pickEnum(statusRaw, ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const, item.status as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE')
  await patchBy('/api/admin/assets', item.id, { name: name || item.name, kind, status }, reloadAll, 'Asset updated')
}

async function editMachine(item: Machine) {
  const name = ask('Machine name', item.name)
  if (name === null) return
  const locationLabel = ask('Location label', item.locationLabel || 'Default')
  if (locationLabel === null) return
  const statusRaw = ask('Status: AVAILABLE | RESERVED | RUNNING | MAINTENANCE', item.status)
  if (statusRaw === null) return
  const status = pickEnum(statusRaw, ['AVAILABLE', 'RESERVED', 'RUNNING', 'MAINTENANCE'] as const, item.status as 'AVAILABLE' | 'RESERVED' | 'RUNNING' | 'MAINTENANCE')
  await patchBy('/api/admin/machines', item.id, { name: name || item.name, locationLabel: locationLabel || item.locationLabel, status }, reloadAll, 'Machine updated')
}

async function editDevice(item: Device) {
  const deviceUid = ask('Device UID (blank = null)', item.deviceUid || '')
  if (deviceUid === null) return
  const fwVersion = ask('FW Version (blank = null)', item.fwVersion || '')
  if (fwVersion === null) return
  await patchBy('/api/admin/devices', item.id, { deviceUid: deviceUid || null, fwVersion: fwVersion || null }, reloadAll, 'Device updated')
}

async function editRegistrationCode(item: RegistrationCode) {
  const statusRaw = ask('Status: READY | USED | EXPIRED | REVOKED', item.status)
  if (statusRaw === null) return
  const status = pickEnum(statusRaw, ['READY', 'USED', 'EXPIRED', 'REVOKED'] as const, item.status as 'READY' | 'USED' | 'EXPIRED' | 'REVOKED')
  await patchBy('/api/admin/device-registration-codes', item.id, { status }, loadRegistrationCodes, 'Registration code updated')
}

async function editDeviceKey(item: DeviceKey) {
  const statusRaw = ask('Status: ACTIVE | REVOKED', item.status)
  if (statusRaw === null) return
  const status = pickEnum(statusRaw, ['ACTIVE', 'REVOKED'] as const, item.status as 'ACTIVE' | 'REVOKED')
  await patchBy('/api/admin/device-keys', item.id, { status }, loadDeviceKeys, 'Device key updated')
}

async function editUser(item: UserRow) {
  const name = ask('User name (blank = null)', item.name || '')
  if (name === null) return
  const roleRaw = ask('Role: ADMIN | USER', item.role)
  if (roleRaw === null) return
  const activeRaw = ask('Active: true | false', String(item.isActive))
  if (activeRaw === null) return
  const role = pickEnum(roleRaw, ['ADMIN', 'USER'] as const, item.role)
  const isActive = ['true', '1', 'yes', 'y', 'active'].includes(activeRaw.toLowerCase())
  await patchBy('/api/admin/users', item.id, { name: name || null, role, isActive }, loadUsers, 'User updated')
}

async function runRegisterTest() {
  await run(async () => {
    registerResult.value = await $fetch('/api/device/register', {
      method: 'POST',
      body: registerTest.value
    })
    setMessage('IoT register success')
  })
}

const selectedTenant = computed(() => tenants.value.find(item => item.id === selectedTenantId.value) || null)
type AdminView = 'all' | 'tenant' | 'merchant' | 'branch' | 'asset' | 'machine' | 'device' | 'user'

const route = useRoute()
const adminView = computed<AdminView>(() => {
  const path = route.path.toLowerCase()
  if (path.endsWith('/tenants')) return 'tenant'
  if (path.endsWith('/merchants')) return 'merchant'
  if (path.endsWith('/branches')) return 'branch'
  if (path.endsWith('/assets')) return 'asset'
  if (path.endsWith('/machines')) return 'machine'
  if (path.endsWith('/devices')) return 'device'
  if (path.endsWith('/users')) return 'user'
  return 'all'
})

const pageTitle = computed(() => {
  const map: Record<AdminView, string> = {
    all: 'CRUD + Device Register Console',
    tenant: 'Tenant Management',
    merchant: 'Merchant Management',
    branch: 'Branch Management',
    asset: 'Asset Management',
    machine: 'Machine Management',
    device: 'Device Management & Onboarding',
    user: 'User / Admin Management'
  }
  return map[adminView.value]
})

function canShow(section: 'tenant' | 'merchant' | 'branch' | 'asset' | 'machine' | 'device' | 'deviceOps' | 'user') {
  if (adminView.value === 'all') return true
  if (section === 'deviceOps') return adminView.value === 'device'
  return adminView.value === section
}

onMounted(async () => {
  await run(reloadAll)
})
</script>

<template>
  <div class="mx-auto w-full max-w-none px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
    <div class="section-card p-5">
      <div class="flex flex-wrap items-center gap-3">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600">Admin Ops</p>
        <a href="/admin/ops" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">All</a>
        <a href="/admin/tenants" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Tenants</a>
        <a href="/admin/merchants" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Merchants</a>
        <a href="/admin/branches" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Branches</a>
        <a href="/admin/assets" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Assets</a>
        <a href="/admin/machines" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Machines</a>
        <a href="/admin/devices" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Devices</a>
        <a href="/admin/users" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Users</a>
        <a href="/admin/settings" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Payment Settings</a>
        <a href="/auth/signin" class="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Auth Signin</a>
      </div>
      <h1 class="mt-1 text-2xl font-semibold text-slate-900">{{ pageTitle }}</h1>
      <p class="mt-1 text-sm text-slate-600">จัดการ Tenant/Merchant/Branch/Asset/Machine/Device พร้อม User/Admin และ IoT Registration</p>

      <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <UInput v-model="adminKey" placeholder="x-admin-key (optional if admin session)" type="password" size="lg" />
        <UButton color="neutral" :loading="loading" @click="run(reloadAll)">Reload All</UButton>
      </div>

      <p v-if="message" class="mt-3 text-sm font-medium text-emerald-700">{{ message }}</p>
      <p v-if="error" class="mt-2 text-sm font-medium text-rose-600">{{ error }}</p>
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      <section v-if="canShow('tenant')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">Tenant</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newTenant.code" placeholder="code" />
          <UInput v-model="newTenant.name" placeholder="name" />
          <UButton class="sm:col-span-2" :loading="loading" @click="createTenant">Create Tenant</UButton>
        </div>
        <div class="mt-3 space-y-2">
          <label class="text-xs text-slate-500">Active Tenant</label>
          <select v-model="selectedTenantId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">- select -</option>
            <option v-for="item in tenants" :key="item.id" :value="item.id">{{ item.code }} • {{ item.name }}</option>
          </select>
        </div>
        <div class="mt-3 space-y-2 text-sm">
          <div v-for="item in tenants" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.code }} • {{ item.name }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editTenant(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/tenants', item.id, reloadAll)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canShow('merchant')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">Merchant</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newMerchant.code" placeholder="code" />
          <UInput v-model="newMerchant.name" placeholder="name" />
          <UButton class="sm:col-span-2" :disabled="!selectedTenantId" :loading="loading" @click="createMerchant">Create Merchant</UButton>
        </div>
        <div class="mt-3 space-y-2">
          <label class="text-xs text-slate-500">Active Merchant</label>
          <select v-model="selectedMerchantId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">- select -</option>
            <option v-for="item in merchants" :key="item.id" :value="item.id">{{ item.code }} • {{ item.name }}</option>
          </select>
        </div>
        <div class="mt-3 space-y-2 text-sm">
          <div v-for="item in merchants" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.code }} • {{ item.name }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editMerchant(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/merchants', item.id, reloadAll)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canShow('branch')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">Branch</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newBranch.code" placeholder="code (e.g. 105)" />
          <UInput v-model="newBranch.name" placeholder="name (e.g. RGH-18)" />
          <UButton class="sm:col-span-2" :disabled="!selectedTenantId" :loading="loading" @click="createBranch">Create Branch</UButton>
        </div>
        <div class="mt-3 space-y-2">
          <label class="text-xs text-slate-500">Active Branch</label>
          <select v-model="selectedBranchId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">- select -</option>
            <option v-for="item in branches" :key="item.id" :value="item.id">{{ item.code }} • {{ item.name }}</option>
          </select>
        </div>
        <div class="mt-3 space-y-2 text-sm">
          <div v-for="item in branches" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.code }} • {{ item.name }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editBranch(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/branches', item.id, reloadAll)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canShow('asset')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">Asset</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newAsset.assetUuid" placeholder="asset UUID (optional)" />
          <UInput v-model="newAsset.code" placeholder="asset code" />
          <UInput v-model="newAsset.name" placeholder="asset name" />
          <select v-model="newAsset.kind" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="WASHER">WASHER</option>
            <option value="DRYER">DRYER</option>
          </select>
          <UButton class="sm:col-span-2" :disabled="!selectedTenantId || !selectedBranchId" :loading="loading" @click="createAsset">Create Asset</UButton>
        </div>
        <div class="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
          <div v-for="item in assets" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.code }} • {{ item.name }} • {{ item.assetUuid }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editAsset(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/assets', item.id, reloadAll)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canShow('machine')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">Machine</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newMachine.code" placeholder="machine code" />
          <UInput v-model="newMachine.name" placeholder="machine name" />
          <UInput v-model="newMachine.locationLabel" placeholder="location label" />
          <select v-model="newMachine.kind" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="WASHER">WASHER</option>
            <option value="DRYER">DRYER</option>
          </select>
          <UButton class="sm:col-span-2" :disabled="!selectedTenantId" :loading="loading" @click="createMachine">Create Machine</UButton>
        </div>
        <div class="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
          <div v-for="item in machines" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.code }} • {{ item.name }} • {{ item.status }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editMachine(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/machines', item.id, reloadAll)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canShow('device')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">Device (IoT)</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newDevice.macAddress" placeholder="MAC Address" />
          <UInput v-model="newDevice.deviceUid" placeholder="Device UID" />
          <UInput v-model="newDevice.fwVersion" placeholder="FW Version" />
          <UButton class="sm:col-span-2" :disabled="!selectedTenantId" :loading="loading" @click="createDevice">Create Device</UButton>
        </div>
        <div class="mt-3 space-y-2">
          <label class="text-xs text-slate-500">Active Device</label>
          <select v-model="selectedDeviceId" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">- select -</option>
            <option v-for="item in devices" :key="item.id" :value="item.id">{{ item.macAddress }} • {{ item.deviceUid || '-' }}</option>
          </select>
        </div>
        <div class="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
          <div v-for="item in devices" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.macAddress }} • {{ item.deviceUid || '-' }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editDevice(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/devices', item.id, reloadAll)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canShow('deviceOps')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">Device Registration Codes</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newRegistrationCode.expiresAt" placeholder="expiresAt ISO (optional)" />
          <UInput v-model="newRegistrationCode.note" placeholder="note" />
          <UButton class="sm:col-span-2" :disabled="!selectedTenantId" :loading="loading" @click="createRegistrationCode">Create Registration Code</UButton>
        </div>
        <div class="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
          <div v-for="item in registrationCodes" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.code }} • {{ item.status }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editRegistrationCode(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/device-registration-codes', item.id, loadRegistrationCodes)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canShow('deviceOps')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">Device Keys</h2>
        <p class="mt-1 text-xs text-slate-500">เลือก Device ก่อน แล้วค่อยสร้าง key</p>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newDeviceKey.label" placeholder="label" />
          <UInput v-model="newDeviceKey.expiresAt" placeholder="expiresAt ISO (optional)" />
          <UButton class="sm:col-span-2" :disabled="!selectedDeviceId" :loading="loading" @click="createDeviceKey">Create Device Key</UButton>
        </div>
        <div class="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
          <div v-for="item in deviceKeys" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.keyPrefix }} • {{ item.status }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editDeviceKey(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/device-keys', item.id, loadDeviceKeys)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canShow('user')" class="section-card p-4">
        <h2 class="text-lg font-semibold text-slate-900">User/Admin</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <UInput v-model="newAdminUser.email" placeholder="admin email" />
          <UInput v-model="newAdminUser.name" placeholder="admin name" />
          <UInput v-model="newAdminUser.password" type="password" placeholder="password (8+)" />
          <UButton class="sm:col-span-2" :loading="loading" @click="bootstrapAdmin">Bootstrap Admin</UButton>
        </div>
        <div class="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
          <div v-for="item in users" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{{ item.email }} • {{ item.role }} • {{ item.isActive ? 'Active' : 'Disabled' }}</span>
            <div class="flex items-center gap-3">
              <button class="text-sky-700" @click="editUser(item)">Edit</button>
              <button class="text-rose-600" @click="deleteBy('/api/admin/users', item.id, loadUsers)">Delete</button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section v-if="canShow('deviceOps')" class="section-card mt-5 p-4">
      <h2 class="text-lg font-semibold text-slate-900">IoT Auto Register Test</h2>
      <p class="mt-1 text-sm text-slate-600">ใช้ทดสอบ flow ลงทะเบียนเครื่องจาก Registration Code</p>
      <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <UInput v-model="registerTest.registrationCode" placeholder="registrationCode" />
        <UInput v-model="registerTest.macAddress" placeholder="MAC" />
        <UInput v-model="registerTest.deviceUid" placeholder="deviceUid" />
        <UInput v-model="registerTest.fwVersion" placeholder="fwVersion" />
        <UInput v-model="registerTest.machineSerialNo" placeholder="machineSerialNo" />
        <UInput v-model="registerTest.machineName" placeholder="machineName" />
        <select v-model="registerTest.machineKind" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="WASHER">WASHER</option>
          <option value="DRYER">DRYER</option>
        </select>
        <UInput v-model="registerTest.machineCode" placeholder="machineCode (optional)" />
        <UInput v-model="registerTest.locationLabel" placeholder="locationLabel (optional)" />
      </div>
      <div class="mt-3">
        <UButton :loading="loading" color="warning" @click="runRegisterTest">Run Register</UButton>
      </div>
      <pre v-if="registerResult" class="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-emerald-300">{{ JSON.stringify(registerResult, null, 2) }}</pre>
    </section>

    <div class="mt-5 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
      Active Tenant: <strong>{{ selectedTenant?.code || '-' }}</strong>
    </div>
  </div>
</template>
