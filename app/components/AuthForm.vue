<script setup lang="ts">
const props = defineProps<{ mode: 'signin' | 'signup' }>()
const { t } = useI18n()
const busy = ref(false)
const error = ref('')
const info = ref('')
const isSignup = computed(() => props.mode === 'signup')

async function submit(event: Event) {
  event.preventDefault()
  error.value = ''
  info.value = ''
  busy.value = true
  const form = new FormData(event.target as HTMLFormElement)
  const email = String(form.get('email') || '').trim()
  const password = String(form.get('password') || '')
  try {
    if (isSignup.value) {
      const name = String(form.get('name') || '').trim()
      const { data, error: authError } = await useSupabase().auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: `${window.location.origin}/auth/callback` }
      })
      if (authError) throw authError
      if (!data.session) {
        info.value = t.value.auth.emailVerificationRequired
        return
      }
    } else {
      const { error: authError } = await useSupabase().auth.signInWithPassword({ email, password })
      if (authError) throw authError
    }
    await navigateTo('/record')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.auth.authenticationFailed
  } finally {
    busy.value = false
  }
}

async function oauth(provider: 'github' | 'google') {
  error.value = ''
  busy.value = true
  try {
    const { error: authError } = await useSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (authError) throw authError
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.auth.authenticationFailed
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-semibold text-highlighted">{{ isSignup ? t.auth.signUp : t.auth.signIn }}</h1>
        <p class="mt-1 text-sm text-muted">{{ isSignup ? t.auth.signUpDescription : t.auth.signInDescription }}</p>
      </template>
      <form class="space-y-4" @submit="submit">
        <UFormField v-if="isSignup" :label="t.auth.fullName" name="name" required>
          <UInput name="name" autocomplete="name" required maxlength="100" class="w-full" />
        </UFormField>
        <UFormField :label="t.auth.email" name="email" required>
          <UInput name="email" type="email" autocomplete="email" required maxlength="255" class="w-full" />
        </UFormField>
        <UFormField :label="t.auth.password" name="password" required>
          <UInput name="password" type="password" :autocomplete="isSignup ? 'new-password' : 'current-password'" minlength="8" required class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="soft" :title="error" />
        <UAlert v-if="info" color="success" variant="soft" :title="info" />
        <UButton type="submit" block :loading="busy">{{ isSignup ? t.auth.createAccount : t.auth.signIn }}</UButton>
      </form>
      <div class="my-5 flex items-center gap-3 text-xs text-muted"><span class="h-px flex-1 bg-default" />{{ t.auth.orContinueWith }}<span class="h-px flex-1 bg-default" /></div>
      <div class="grid grid-cols-2 gap-3">
        <UButton color="neutral" variant="outline" :disabled="busy" @click="oauth('github')">GitHub</UButton>
        <UButton color="neutral" variant="outline" :disabled="busy" @click="oauth('google')">Google</UButton>
      </div>
      <template #footer>
        <p class="text-center text-sm text-muted">
          <template v-if="isSignup">{{ t.auth.alreadyHaveAccount }} <NuxtLink to="/sign-in" class="text-primary underline">{{ t.auth.signIn }}</NuxtLink></template>
          <template v-else>{{ t.auth.newToSoon }} <NuxtLink to="/sign-up" class="text-primary underline">{{ t.auth.signUp }}</NuxtLink></template>
        </p>
      </template>
    </UCard>
  </div>
</template>
