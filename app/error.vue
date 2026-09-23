<script setup lang="ts">
defineProps<{ error: { statusCode?: number; statusMessage?: string; message?: string } }>()
</script>

<template>
  <NuxtLayout>
    <div class="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 class="text-3xl font-semibold text-highlighted">{{ error.statusCode || 500 }}</h1>
      <p class="mt-3 text-muted">{{ error.statusMessage || error.message || 'Something went wrong.' }}</p>
      <UButton to="/" class="mt-6">Back to SOON</UButton>
    </div>
  </NuxtLayout>
</template>
