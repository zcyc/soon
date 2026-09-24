<script setup lang="ts">
const { t } = useI18n()
const auth = useAuth()
const busy = ref(false)
const error = ref('')

async function submit(event: Event) {
  event.preventDefault()
  error.value = ''
  busy.value = true
  const form = new FormData(event.target as HTMLFormElement)
  const account = String(form.get('account') || '').trim()
  const password = String(form.get('password') || '')
  try {
    await auth.signIn(account, password)
    await navigateTo('/record')
  } catch {
    error.value = t.value.auth.authenticationFailed
  } finally {
    busy.value = false
  }
}

</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-semibold text-highlighted">{{ t.auth.signIn }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t.auth.signInDescription }}</p>
      </template>
      <form class="space-y-4" @submit="submit">
        <UFormField :label="t.auth.account" name="account" required>
          <UInput name="account" autocomplete="username" required maxlength="128" class="w-full" />
        </UFormField>
        <UFormField :label="t.auth.password" name="password" required>
          <UInput name="password" type="password" autocomplete="current-password" minlength="12" required class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="soft" :title="error" />
        <UButton type="submit" block :loading="busy">{{ t.auth.signIn }}</UButton>
      </form>
    </UCard>
  </div>
</template>
