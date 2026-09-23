<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
const user = useCurrentUser()
const loggingOut = ref(false)

async function signOut() {
  loggingOut.value = true
  await useSupabase().auth.signOut()
  user.value = null
  loggingOut.value = false
  await navigateTo('/sign-in')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-default text-default">
    <header class="border-b border-default bg-default">
      <div class="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-6">
          <NuxtLink to="/" class="font-semibold text-lg text-highlighted">SOON</NuxtLink>
          <nav class="hidden items-center gap-4 sm:flex" aria-label="Main navigation">
            <NuxtLink to="/record" class="text-sm text-muted hover:text-highlighted">{{ t.nav.record }}</NuxtLink>
            <NuxtLink to="/discover" class="text-sm text-muted hover:text-highlighted">{{ t.nav.discover }}</NuxtLink>
          </nav>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <USelect
            :model-value="locale"
            :items="[{ label: 'English', value: 'en' }, { label: '简体中文', value: 'zh' }]"
            aria-label="Language"
            class="w-32"
            @update:model-value="setLocale"
          />
          <UButton v-if="user" color="neutral" variant="ghost" :loading="loggingOut" @click="signOut">
            {{ t.nav.signOut }}
          </UButton>
          <UButton v-else to="/sign-in" color="neutral" variant="ghost">
            {{ t.auth.signIn }}
          </UButton>
        </div>
      </div>
      <nav class="flex gap-4 border-t border-default px-4 py-2 sm:hidden" aria-label="Mobile navigation">
        <NuxtLink to="/record" class="text-sm text-muted">{{ t.nav.record }}</NuxtLink>
        <NuxtLink to="/discover" class="text-sm text-muted">{{ t.nav.discover }}</NuxtLink>
      </nav>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default">
      <div class="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-4 py-5 text-sm text-muted sm:px-6">
        <span>© {{ new Date().getFullYear() }} SOON</span>
        <div class="flex gap-4">
          <NuxtLink to="/privacy-policy">{{ t.footer.privacyPolicy }}</NuxtLink>
          <NuxtLink to="/terms-of-service">{{ t.footer.termsOfService }}</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>
