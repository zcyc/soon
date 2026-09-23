<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const message = ref(t.value.auth.loading)
const error = ref('')

onMounted(async () => {
  if (route.query.error) {
    error.value = String(route.query.error_description || route.query.error)
    return
  }
  const { data, error: authError } = await useSupabase().auth.getUser()
  if (authError || !data.user) {
    error.value = authError?.message || t.value.auth.authenticationFailed
    return
  }
  await navigateTo('/record')
})
</script>

<template>
  <div class="mx-auto max-w-lg px-4 py-16 text-center">
    <UAlert v-if="error" color="error" variant="soft" :title="error" />
    <p v-else class="text-muted" role="status">{{ message }}</p>
    <UButton v-if="error" to="/sign-in" class="mt-4">{{ t.auth.signIn }}</UButton>
  </div>
</template>
