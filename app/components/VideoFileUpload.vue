<script setup lang="ts">
import { getVideoMimeType } from '~/utils/video'

const emit = defineEmits<{ uploaded: [] }>()
const { t } = useI18n()
const user = useCurrentUser()
const { upload } = useVideoUpload()
const file = shallowRef<File | null>(null)
const title = ref('')
const isPublic = ref(false)
const isPublish = ref(false)
const progress = ref(0)
const uploading = ref(false)
const error = ref('')
const formatWarning = ref('')
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0] || null
  input.value = ''
  file.value = selected
  error.value = ''
  formatWarning.value = ''
  progress.value = 0
  if (!selected) return

  if (!getVideoMimeType(selected)) {
    file.value = null
    error.value = t.value.fileUpload.invalidFileType
    return
  }
  if (selected.size > MAX_FILE_SIZE) {
    file.value = null
    error.value = t.value.fileUpload.fileSizeExceeded
    return
  }
  if (!title.value) title.value = selected.name.replace(/\.[^.]+$/, '').slice(0, 160)
  const mimeType = getVideoMimeType(selected)
  if (mimeType && document.createElement('video').canPlayType(mimeType) === '') {
    formatWarning.value = t.value.fileUpload.formatWarning
  }
}

async function uploadSelectedFile() {
  if (!file.value || !user.value || uploading.value) return
  uploading.value = true
  error.value = ''
  try {
    await upload({
      blob: file.value,
      fileName: file.value.name,
      title: title.value,
      quality: 'original',
      isPublic: isPublic.value,
      isPublish: isPublish.value,
      onProgress: value => { progress.value = value }
    })
    file.value = null
    title.value = ''
    progress.value = 100
    emit('uploaded')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.fileUpload.uploadFailed
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="text-xl font-semibold text-highlighted">{{ t.fileUpload.selectVideoFile }}</h2>
        <p class="mt-1 text-sm text-muted">{{ t.fileUpload.maxFileSize }}</p>
      </div>
    </template>

    <div class="space-y-4">
      <UFormField :label="t.fileUpload.selectVideoFile">
        <input
          type="file"
          accept="video/*,.mkv,.avi,.3gp,.ogv"
          :disabled="uploading"
          class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-2"
          @change="selectFile"
        >
      </UFormField>
      <UFormField :label="t.recording.videoTitle">
        <UInput v-model="title" :placeholder="t.recording.videoTitlePlaceholder" :disabled="uploading" maxlength="160" class="w-full" />
      </UFormField>
      <p v-if="file" class="text-sm text-muted">{{ file.name }} · {{ (file.size / 1024 / 1024).toFixed(1) }} MB</p>
      <UAlert v-if="formatWarning" color="warning" variant="soft" :title="formatWarning" />
      <UAlert v-if="error" color="error" variant="soft" :title="error" />
      <UProgress v-if="uploading" :model-value="progress" />
      <label class="flex items-center gap-2 text-sm">
        <input v-model="isPublic" type="checkbox" :disabled="uploading">
        {{ t.recording.publicVideo }}
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="isPublish" type="checkbox" :disabled="uploading">
        {{ t.publish.publishToDiscovery }}
      </label>
      <UButton :loading="uploading" :disabled="!file || !user" @click="uploadSelectedFile">
        {{ uploading ? `${t.fileUpload.uploading} ${progress}%` : t.recording.upload }}
      </UButton>
      <p v-if="!user" class="text-sm text-muted">
        {{ t.guest.loginPrompt }} <NuxtLink to="/sign-in" class="text-primary underline">{{ t.auth.signIn }}</NuxtLink>
      </p>
    </div>
  </UCard>
</template>
