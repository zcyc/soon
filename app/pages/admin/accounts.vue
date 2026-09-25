<script setup lang="ts">
type AccountRole = 'admin' | 'user'
interface ManagedAccount {
  id: string
  account: string
  role: AccountRole
  isActive: boolean
  createdAt: string
}

const { t } = useI18n()
const auth = useAuth()
const currentUser = auth.user
const { apiFetch } = useApi()
const accounts = ref<ManagedAccount[]>([])
const allowRegistration = ref(false)
const loading = ref(true)
const busyId = ref('')
const savingRegistration = ref(false)
const creating = ref(false)
const account = ref('')
const password = ref('')
const role = ref<AccountRole>('user')
const resetPasswords = reactive<Record<string, string>>({})
const error = ref('')
const success = ref('')

async function loadAccounts() {
  loading.value = true
  error.value = ''
  try {
    await auth.restoreSession()
    const result = await apiFetch<{ accounts: ManagedAccount[]; allowRegistration: boolean }>('admin/accounts')
    accounts.value = result.accounts
    allowRegistration.value = result.allowRegistration
  } catch (cause) {
    console.error('Unable to load SOON accounts.', cause instanceof Error ? cause.message : String(cause))
    error.value = t.value.accounts.loadFailed
  } finally {
    loading.value = false
  }
}

async function saveRegistration(event: Event) {
  const nextValue = (event.target as HTMLInputElement).checked
  savingRegistration.value = true
  error.value = ''
  try {
    const result = await apiFetch<{ allowRegistration: boolean }>('admin/settings', {
      method: 'PATCH',
      body: { allowRegistration: nextValue }
    })
    allowRegistration.value = result.allowRegistration
    success.value = t.value.accounts.saved
  } catch (cause) {
    console.error('Unable to save the SOON registration setting.', cause instanceof Error ? cause.message : String(cause))
    error.value = t.value.accounts.updateFailed
  } finally {
    savingRegistration.value = false
  }
}

async function createAccount(event: Event) {
  event.preventDefault()
  creating.value = true
  error.value = ''
  success.value = ''
  try {
    const created = await apiFetch<ManagedAccount>('admin/accounts', {
      method: 'POST',
      body: { account: account.value.trim(), password: password.value, role: role.value }
    })
    accounts.value.push(created)
    account.value = ''
    password.value = ''
    role.value = 'user'
    success.value = t.value.accounts.created
  } catch (cause) {
    console.error('Unable to create a SOON account.', cause instanceof Error ? cause.message : String(cause))
    error.value = t.value.accounts.createFailed
  } finally {
    creating.value = false
  }
}

async function updateAccount(item: ManagedAccount, changes: { role?: AccountRole; isActive?: boolean; password?: string }) {
  busyId.value = item.id
  error.value = ''
  success.value = ''
  try {
    const updated = await apiFetch<ManagedAccount>(`admin/accounts/${encodeURIComponent(item.id)}`, {
      method: 'PATCH',
      body: changes
    })
    Object.assign(item, updated)
    if (changes.password) resetPasswords[item.id] = ''
    success.value = t.value.accounts.saved
  } catch (cause) {
    console.error('Unable to update a SOON account.', cause instanceof Error ? cause.message : String(cause))
    error.value = t.value.accounts.updateFailed
  } finally {
    busyId.value = ''
  }
}

function changeRole(item: ManagedAccount, event: Event) {
  const role = (event.target as HTMLSelectElement).value
  if (role === 'admin' || role === 'user') void updateAccount(item, { role })
}

function changeActive(item: ManagedAccount, event: Event) {
  void updateAccount(item, { isActive: (event.target as HTMLInputElement).checked })
}

onMounted(() => { void loadAccounts() })
</script>

<template>
  <section class="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <header>
      <h1 class="text-2xl font-semibold text-highlighted">{{ t.accounts.title }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t.accounts.description }}</p>
    </header>

    <UAlert v-if="error" color="error" variant="soft" :title="error" />
    <UAlert v-else-if="success" color="success" variant="soft" :title="success" />

    <UCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="font-semibold text-highlighted">{{ t.accounts.registration }}</h2>
          <p class="mt-1 text-sm text-muted">{{ t.accounts.registrationDescription }}</p>
        </div>
        <label class="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            :checked="allowRegistration"
            :disabled="savingRegistration || loading"
            @change="saveRegistration"
          >
          {{ t.accounts.allowRegistration }}
        </label>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">{{ t.accounts.createAccount }}</h2>
      </template>
      <form class="grid gap-4 sm:grid-cols-2" @submit="createAccount">
        <UFormField :label="t.auth.account" name="account" required>
          <UInput v-model="account" autocomplete="username" maxlength="128" required class="w-full" />
        </UFormField>
        <UFormField :label="t.auth.password" name="password" required>
          <UInput v-model="password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required class="w-full" />
        </UFormField>
        <UFormField :label="t.accounts.role" name="role">
          <select v-model="role" class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm">
            <option value="user">{{ t.accounts.user }}</option>
            <option value="admin">{{ t.accounts.administrator }}</option>
          </select>
        </UFormField>
        <div class="flex items-end">
          <UButton type="submit" :loading="creating">{{ t.accounts.createAccount }}</UButton>
        </div>
      </form>
    </UCard>

    <div>
      <h2 class="mb-3 font-semibold text-highlighted">{{ t.accounts.title }}</h2>
      <p v-if="loading" class="text-sm text-muted">{{ t.common.loading }}</p>
      <div v-else class="space-y-3">
        <UCard v-for="item in accounts" :key="item.id">
          <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_9rem_9rem_minmax(14rem,1fr)] lg:items-center">
            <div class="min-w-0">
              <p class="truncate font-medium text-highlighted">{{ item.account }}</p>
              <p class="text-xs text-muted">{{ item.createdAt }}</p>
            </div>
            <label class="space-y-1 text-sm">
              <span class="block text-muted">{{ t.accounts.role }}</span>
              <select
                :value="item.role"
                class="w-full rounded-md border border-default bg-default px-2 py-1.5"
                :disabled="busyId === item.id || item.id === currentUser?.id"
                @change="changeRole(item, $event)"
              >
                <option value="user">{{ t.accounts.user }}</option>
                <option value="admin">{{ t.accounts.administrator }}</option>
              </select>
            </label>
            <label class="inline-flex items-center gap-2 text-sm">
              <input
                :checked="item.isActive"
                type="checkbox"
                :disabled="busyId === item.id || item.id === currentUser?.id"
                @change="changeActive(item, $event)"
              >
              {{ item.isActive ? t.accounts.active : t.accounts.disabled }}
            </label>
            <form class="flex items-end gap-2" @submit.prevent="updateAccount(item, { password: resetPasswords[item.id] ?? '' })">
              <UFormField :label="t.accounts.newPassword" :name="`password-${item.id}`" class="min-w-0 flex-1">
                <UInput
                  v-model="resetPasswords[item.id]"
                  type="password"
                  autocomplete="new-password"
                  minlength="12"
                  maxlength="1024"
                  required
                  class="w-full"
                />
              </UFormField>
              <UButton type="submit" color="neutral" variant="outline" :loading="busyId === item.id">
                {{ t.accounts.resetPassword }}
              </UButton>
            </form>
          </div>
        </UCard>
      </div>
    </div>
  </section>
</template>
