<script setup lang="ts">
import type { Video } from '~/utils/video'

const props = withDefaults(defineProps<{ publicOnly?: boolean }>(), { publicOnly: false })
const { t } = useI18n()
const { apiFetch } = useApi()
const user = useCurrentUser()
const config = useRuntimeConfig()
const apiBase = String(config.public.apiBase || (import.meta.dev ? 'http://localhost:8787' : '')).replace(/\/$/, '')
const publicResult = await useAsyncData(
  props.publicOnly ? 'public-videos' : 'owner-videos',
  async () => {
    if (!props.publicOnly) return { videos: [] as Video[] }
    if (!apiBase) throw new Error('NUXT_PUBLIC_API_BASE must be configured for production')
    return await $fetch<{ videos: Video[] }>(`${apiBase}/api/videos/public`)
  },
  { server: props.publicOnly, default: () => ({ videos: [] as Video[] }) }
)
const videos = ref<Video[]>(props.publicOnly ? publicResult.data.value.videos : [])
const search = ref('')
const loading = ref(props.publicOnly ? publicResult.pending.value : true)
const error = ref(props.publicOnly ? publicResult.error.value?.message || '' : '')
const pendingId = ref<string | null>(null)

const filteredVideos = computed(() => {
  const query = search.value.trim().toLowerCase()
  return query ? videos.value.filter(video => `${video.title} ${video.quality}`.toLowerCase().includes(query)) : videos.value
})

async function loadVideos() {
  loading.value = true
  error.value = ''
  if (props.publicOnly) {
    await publicResult.refresh()
    videos.value = publicResult.data.value?.videos || []
    error.value = publicResult.error.value?.message || ''
    loading.value = false
    return
  }

  try {
    const result = user.value
      ? await apiFetch<{ videos: Video[] }>('videos')
      : { videos: [] }
    videos.value = result.videos
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.common.error
  } finally {
    loading.value = false
  }
}

async function togglePrivacy(video: Video) {
  pendingId.value = video.id
  try {
    const result = await apiFetch<{ video: Video }>(`videos/${video.id}/privacy`, {
      method: 'PATCH',
      body: { isPublic: !video.isPublic }
    })
    Object.assign(video, result.video)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.common.error
  } finally {
    pendingId.value = null
  }
}

async function toggleDiscovery(video: Video) {
  pendingId.value = video.id
  try {
    const result = await apiFetch<{ video: Video }>(`videos/${video.id}/discovery`, {
      method: 'PATCH',
      body: { isPublish: !video.isPublish }
    })
    Object.assign(video, result.video)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.common.error
  } finally {
    pendingId.value = null
  }
}

async function deleteVideo(video: Video) {
  if (!window.confirm(t.value.videos.deleteConfirmation)) return
  pendingId.value = video.id
  try {
    await apiFetch(`videos/${video.id}`, { method: 'DELETE' })
    videos.value = videos.value.filter(item => item.id !== video.id)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.common.error
  } finally {
    pendingId.value = null
  }
}

async function copyShareLink(video: Video) {
  const url = `${window.location.origin}/share/${video.id}`
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url)
    else window.prompt(t.value.recording.copyShareLink, url)
  } catch {
    window.prompt(t.value.recording.copyShareLink, url)
  }
}

onMounted(() => {
  if (!props.publicOnly) void loadVideos()
})
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-2xl font-semibold text-highlighted">
          {{ publicOnly ? t.dashboard.publicVideos : t.dashboard.myVideos }}
        </h2>
      </div>
      <UInput v-model="search" type="search" :placeholder="t.videos.searchPlaceholder" class="w-full sm:max-w-xs" />
    </div>

    <UAlert v-if="error" color="error" variant="soft" :title="error">
      <template #actions>
        <UButton size="xs" color="error" variant="outline" @click="loadVideos">{{ t.common.retry }}</UButton>
      </template>
    </UAlert>
    <div v-else-if="loading" class="py-10 text-center text-muted" role="status">{{ t.common.loading }}</div>
    <UCard v-else-if="filteredVideos.length === 0" class="py-6 text-center text-muted">
      {{ search ? t.dashboard.noMatchingVideos : publicOnly ? t.dashboard.noPublicVideos : t.dashboard.noVideosYet }}
    </UCard>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="video in filteredVideos" :key="video.id" class="min-w-0">
        <NuxtLink :to="`/share/${video.id}`" class="block">
          <img
            v-if="video.thumbnailUrl"
            :src="video.thumbnailUrl"
            :alt="''"
            loading="lazy"
            class="mb-3 aspect-video w-full rounded-md object-cover"
          >
          <div v-else class="mb-3 flex aspect-video items-center justify-center rounded-md bg-elevated text-muted">
            {{ t.recording.previewPlaceholder }}
          </div>
          <h3 class="truncate font-medium text-highlighted">{{ video.title }}</h3>
        </NuxtLink>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{{ formatDuration(video.duration) }}</span>
          <span>{{ video.views }} {{ t.share.views }}</span>
          <UBadge v-if="!publicOnly" color="neutral" variant="subtle">
            {{ video.isPublic ? t.videos.public : t.videos.private }}
          </UBadge>
        </div>
        <div v-if="!publicOnly" class="mt-4 flex flex-wrap gap-2">
          <UButton size="sm" color="neutral" variant="outline" :loading="pendingId === video.id" @click="togglePrivacy(video)">
            {{ video.isPublic ? t.videos.makePrivate : t.videos.makePublic }}
          </UButton>
          <UButton size="sm" color="neutral" variant="outline" :loading="pendingId === video.id" @click="toggleDiscovery(video)">
            {{ video.isPublish ? t.publish.removeFromDiscovery : t.publish.publishToDiscovery }}
          </UButton>
          <UButton size="sm" color="neutral" variant="outline" @click="copyShareLink(video)">
            {{ t.recording.copyShareLink }}
          </UButton>
          <UButton size="sm" color="error" variant="soft" :loading="pendingId === video.id" @click="deleteVideo(video)">
            {{ t.videos.delete }}
          </UButton>
        </div>
      </UCard>
    </div>
  </section>
</template>
