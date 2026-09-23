<script setup lang="ts">
const { t } = useI18n()
const user = useCurrentUser()
const galleryKey = ref(0)
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
    <section v-if="user" class="space-y-1">
      <h1 class="text-3xl font-semibold text-highlighted">{{ t.dashboard.welcomeBack }}, {{ user.user_metadata?.name || user.email }}!</h1>
      <p class="text-muted">{{ t.dashboard.welcomeDescription }}</p>
    </section>

    <ScreenRecorder @uploaded="galleryKey++" />
    <VideoFileUpload @uploaded="galleryKey++" />

    <UAlert v-if="!user" color="neutral" variant="subtle" :title="t.guest.notification">
      <template #actions>
        <UButton to="/sign-in" size="sm">{{ t.auth.signIn }}</UButton>
      </template>
    </UAlert>
    <VideoGallery v-else :key="galleryKey" />
  </div>
</template>
