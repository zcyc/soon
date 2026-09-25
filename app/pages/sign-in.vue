<script setup lang="ts">
const { t } = useI18n()
const { data: status } = await useFetch<{ setupRequired: boolean; registrationAllowed: boolean }>(
  () => `${getApiBaseURL()}/api/auth/status`,
  { key: 'public-auth-status', default: () => ({ setupRequired: false, registrationAllowed: false }) }
)
</script>

<template>
  <div>
    <AuthForm mode="signin" />
    <div class="mx-auto -mt-8 flex max-w-md justify-center gap-4 px-4 pb-12 text-sm">
      <NuxtLink v-if="status?.setupRequired" to="/setup" class="text-primary underline">
        {{ t.auth.setupAdministrator }}
      </NuxtLink>
      <NuxtLink v-else-if="status?.registrationAllowed" to="/sign-up" class="text-primary underline">
        {{ t.auth.signUp }}
      </NuxtLink>
    </div>
  </div>
</template>
