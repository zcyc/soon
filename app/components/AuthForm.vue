<script setup lang="ts">
const props = defineProps<{ mode: 'signin' | 'signup' }>()
const { t } = useI18n()
const auth = useAuth()
const busy = ref(false)
const error = ref('')

const title = computed(() => props.mode === 'signin'
  ? t.value.auth.signIn
  : t.value.auth.signUp)
const description = computed(() => props.mode === 'signin'
  ? t.value.auth.signInDescription
  : t.value.auth.signUpDescription)

function getStatusCode(cause: unknown) {
  return cause && typeof cause === 'object' && 'statusCode' in cause && typeof cause.statusCode === 'number'
    ? cause.statusCode
    : null
}

async function submit(event: Event) {
  event.preventDefault()
  error.value = ''
  busy.value = true
  const form = new FormData(event.target as HTMLFormElement)
  const account = String(form.get('account') || '').trim()
  const password = String(form.get('password') || '')
  const passwordConfirmation = String(form.get('passwordConfirmation') || '')
  if (props.mode !== 'signin' && password !== passwordConfirmation) {
    error.value = t.value.auth.passwordsDoNotMatch
    busy.value = false
    return
  }

  try {
    if (props.mode === 'signup') await auth.register(account, password)
    else await auth.signIn(account, password)
    await navigateTo(auth.user.value?.role === 'admin' ? '/admin/accounts' : '/record')
  } catch (cause) {
    const statusCode = getStatusCode(cause)
    error.value = statusCode === 409
      ? t.value.auth.accountExists
      : statusCode === 403 ? t.value.auth.registrationDisabled : t.value.auth.authenticationFailed
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-semibold text-highlighted">{{ title }}</h1>
        <p class="mt-1 text-sm text-muted">{{ description }}</p>
      </template>
      <form class="space-y-4" @submit="submit">
        <UFormField :label="t.auth.account" name="account" required>
          <UInput name="account" autocomplete="username" required maxlength="128" class="w-full" />
        </UFormField>
        <UFormField :label="t.auth.password" name="password" required>
          <UInput
            name="password"
            type="password"
            :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
            :minlength="mode === 'signin' ? undefined : 12"
            maxlength="1024"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField v-if="mode !== 'signin'" :label="t.auth.confirmPassword" name="passwordConfirmation" required>
          <UInput name="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="soft" :title="error" />
        <UButton type="submit" block :loading="busy">
          {{ mode === 'signin' ? t.auth.signIn : t.auth.signUp }}
        </UButton>
        <NuxtLink v-if="mode !== 'signin'" to="/sign-in" class="block text-center text-sm text-primary underline">
          {{ t.auth.signIn }}
        </NuxtLink>
      </form>
    </UCard>
  </div>
</template>
