<script setup lang="ts">
import { recordingConfig } from '~/utils/config'

const { t } = useI18n()
const runtime = useRuntimeConfig()
const recordingLimitMinutes = computed(() => {
  const configured = Number(runtime.public.recordingMaxDurationSeconds)
  const seconds = Number.isFinite(configured) && configured > 0 ? configured : recordingConfig.maxDurationSeconds
  return Math.ceil(seconds / 60)
})
const features = computed(() => [
  { title: t.value.home.screenRecordingTitle, description: t.value.home.screenRecordingDesc },
  { title: t.value.home.cameraRecordingTitle, description: t.value.home.cameraRecordingDesc },
  { title: t.value.home.audioRecordingTitle, description: t.value.home.audioRecordingDesc },
  { title: t.value.home.highQualityTitle, description: t.value.home.highQualityDesc },
  { title: t.value.home.easyShareTitle, description: t.value.home.easyShareDesc },
  { title: t.value.home.privacyProtectionTitle, description: t.value.home.privacyProtectionDesc }
])
</script>

<template>
  <div>
    <section class="bg-elevated px-4 py-20 sm:py-28">
      <div class="mx-auto max-w-5xl text-center">
        <p class="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-primary">SOON</p>
        <h1 class="text-4xl font-bold tracking-tight text-highlighted sm:text-6xl">{{ t.home.heroTitle }}</h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl">{{ t.home.heroSubtitle }}</p>
        <p class="mt-2 text-sm text-muted">{{ t.home.heroDescription }}</p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <UButton to="/record" size="lg">{{ t.home.getStarted }}</UButton>
          <UButton to="/discover" size="lg" color="neutral" variant="outline">{{ t.nav.discover }}</UButton>
        </div>
        <p class="mt-6 text-sm text-muted">{{ t.home.timeLimitNotice(recordingLimitMinutes) }}</p>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div class="mx-auto mb-10 max-w-2xl text-center">
        <h2 class="text-3xl font-semibold text-highlighted">{{ t.home.featuresTitle }}</h2>
        <p class="mt-3 text-muted">{{ t.home.featuresSubtitle }}</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="feature in features" :key="feature.title">
          <h3 class="font-semibold text-highlighted">{{ feature.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-muted">{{ feature.description }}</p>
        </UCard>
      </div>
    </section>
  </div>
</template>
