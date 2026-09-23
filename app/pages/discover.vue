<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <div>
      <h1 class="text-3xl font-semibold text-highlighted">{{ t.discover.title }}</h1>
      <p class="mt-2 text-muted">{{ t.discover.description }}</p>
    </div>
    <VideoGallery public-only />
  </div>
</template>
