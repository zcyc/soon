<script setup lang="ts">
const { t } = useI18n()
const { data: status } = await useFetch<{ registrationAllowed: boolean }>(
  () => `${getApiBaseURL()}/api/auth/status`,
  { key: 'public-auth-status', default: () => ({ registrationAllowed: false }) }
)
</script>

<template>
  <div>
    <AuthForm mode="signin" />
    <div class="mx-auto -mt-8 flex max-w-md justify-center gap-4 px-4 pb-12 text-sm">
      <NuxtLink v-if="status?.registrationAllowed" to="/sign-up" class="text-primary underline">
        {{ t.auth.signUp }}
      </NuxtLink>
    </div>
  </div>
</template>
