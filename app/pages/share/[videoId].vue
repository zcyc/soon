<script setup lang="ts">
import type { Video } from '~/utils/video'

const route = useRoute()
const { t } = useI18n()
const auth = useAuth()
const { apiFetch } = useApi()
const user = auth.user
const config = useRuntimeConfig()
const apiBase = String(config.public.apiBase || (import.meta.dev ? 'http://localhost:8787' : '')).replace(/\/$/, '')
const video = ref<Video | null>(null)
const mediaUrl = ref('')
const reactions = ref<{ emoji: string; count: number; mine: boolean }[]>([])
const loading = ref(true)
const error = ref('')
const downloadBusy = ref(false)
const reactionBusy = ref(false)
const initialShare = await useAsyncData(
  `share-${String(route.params.videoId)}`,
  async () => {
    if (!apiBase) return null
    const id = encodeURIComponent(String(route.params.videoId))
    try {
      const [videoResponse, mediaResponse, reactionResponse] = await Promise.all([
        $fetch<{ video: Video }>(`${apiBase}/api/videos/${id}`),
        $fetch<{ url: string }>(`${apiBase}/api/videos/${id}/url`),
        $fetch<{ reactions: typeof reactions.value }>(`${apiBase}/api/videos/${id}/reactions`)
      ])
      return { video: videoResponse.video, mediaUrl: mediaResponse.url, reactions: reactionResponse.reactions }
    } catch {
      return null
    }
  },
  { default: () => null }
)

if (initialShare.data.value) {
  video.value = initialShare.data.value.video
  mediaUrl.value = initialShare.data.value.mediaUrl
  reactions.value = initialShare.data.value.reactions
  loading.value = false
}

async function loadVideo() {
  loading.value = true
  error.value = ''
  try {
    const id = encodeURIComponent(String(route.params.videoId))
    const [videoResponse, mediaResponse, reactionResponse] = await Promise.all([
      apiFetch<{ video: Video }>(`videos/${id}`),
      apiFetch<{ url: string }>(`videos/${id}/url`),
      apiFetch<{ reactions: typeof reactions.value }>(`videos/${id}/reactions`)
    ])
    video.value = videoResponse.video
    mediaUrl.value = mediaResponse.url
    reactions.value = reactionResponse.reactions
    await apiFetch(`videos/${id}/views`, { method: 'POST' }).catch(() => undefined)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.share.videoNotFoundDesc
  } finally {
    loading.value = false
  }
}

async function toggleReaction(emoji: string) {
  if (!user.value) {
    await navigateTo('/sign-in')
    return
  }
  if (reactionBusy.value) return
  const videoId = String(route.params.videoId)
  const active = !Boolean(reactions.value.find(item => item.emoji === emoji)?.mine)
  reactionBusy.value = true
  try {
    await apiFetch(`videos/${encodeURIComponent(videoId)}/reactions`, {
      method: 'POST',
      body: { emoji, active }
    })
    const result = await apiFetch<{ reactions: typeof reactions.value }>(`videos/${encodeURIComponent(videoId)}/reactions`)
    if (String(route.params.videoId) === videoId) reactions.value = result.reactions
  } catch (cause) {
    if (String(route.params.videoId) === videoId) {
      error.value = cause instanceof Error ? cause.message : t.value.common.error
    }
  } finally {
    reactionBusy.value = false
  }
}

async function downloadVideo() {
  if (!video.value) return
  downloadBusy.value = true
  error.value = ''
  try {
    const result = await apiFetch<{ url: string }>(`videos/${encodeURIComponent(video.value.id)}/url?download=1`)
    window.location.assign(result.url)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.common.error
  } finally {
    downloadBusy.value = false
  }
}

async function shareVideo() {
  if (!video.value) return
  const url = window.location.href
  if (navigator.share) {
    try {
      await navigator.share({ title: video.value.title, url })
      return
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return
    }
  } catch {
    // Clipboard access can be denied even when the browser exposes the API.
  }
  window.prompt(t.value.recording.copyShareLink, url)
}

onMounted(async () => {
  await auth.restoreSession()
  if (!video.value || user.value) {
    void loadVideo()
  } else {
    void apiFetch(`videos/${encodeURIComponent(String(route.params.videoId))}/views`, { method: 'POST' }).catch(() => undefined)
  }
})
watch(() => route.params.videoId, (next, previous) => {
  if (next !== previous) {
    video.value = null
    mediaUrl.value = ''
    reactions.value = []
    void loadVideo()
  }
})
useSeoMeta({ title: () => video.value?.title || t.value.share.loading })
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
    <div v-if="loading" class="py-20 text-center text-muted" role="status">{{ t.share.loading }}</div>
    <UAlert v-else-if="error || !video" color="warning" variant="soft" :title="t.share.videoNotFound" :description="error || t.share.videoNotFoundDesc">
      <template #actions>
        <UButton to="/" color="neutral" variant="outline">{{ t.share.backToHome }}</UButton>
      </template>
    </UAlert>
    <template v-else>
      <video :src="mediaUrl" :poster="video.thumbnailUrl || undefined" controls playsinline preload="metadata" class="aspect-video w-full rounded-xl bg-black" />
      <div class="flex flex-wrap gap-2" :aria-label="t.share.reactions">
        <UButton
          v-for="reaction in [
            { emoji: '❤️', label: t.share.love },
            { emoji: '😄', label: t.share.happy },
            { emoji: '👏', label: t.share.applause },
            { emoji: '👍', label: t.share.like }
          ]"
          :key="reaction.emoji"
          size="sm"
          :color="reactions.find(item => item.emoji === reaction.emoji)?.mine ? 'primary' : 'neutral'"
          variant="soft"
          :aria-label="reaction.label"
          :aria-pressed="Boolean(reactions.find(item => item.emoji === reaction.emoji)?.mine)"
          :disabled="reactionBusy"
          @click="toggleReaction(reaction.emoji)"
        >
          {{ reaction.emoji }} {{ reactions.find(item => item.emoji === reaction.emoji)?.count || 0 }}
        </UButton>
      </div>
      <UCard>
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div class="min-w-0">
            <h1 class="break-words text-2xl font-semibold text-highlighted">{{ video.title }}</h1>
            <p class="mt-2 text-sm text-muted">{{ video.userName }} · {{ video.views }} {{ t.share.views }} · {{ formatDuration(video.duration) }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton color="neutral" variant="outline" @click="shareVideo">{{ t.recording.shareVideo }}</UButton>
            <UButton :loading="downloadBusy" @click="downloadVideo">{{ t.share.download }}</UButton>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
