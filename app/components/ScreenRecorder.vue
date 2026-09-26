<script setup lang="ts">
import { recordingConfig } from '~/utils/config'

interface SubtitleSegment {
  start: number
  end: number
  text: string
}

interface SpeechAlternative { transcript: string; confidence?: number }
interface SpeechResult { 0: SpeechAlternative; isFinal: boolean }
interface SpeechResultEvent extends Event {
  resultIndex: number
  results: { length: number; [index: number]: SpeechResult }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
interface SpeechRecognitionErrorEvent extends Event { error: string }
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}
type PictureInPictureVideo = HTMLVideoElement & {
  webkitPresentationMode?: string
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture') => void
  webkitSupportsPresentationMode?: (mode: string) => boolean
}

const { t } = useI18n()
const user = useCurrentUser()
const emit = defineEmits<{ uploaded: [] }>()
const runtime = useRuntimeConfig()
const { upload } = useVideoUpload()
const preview = ref<HTMLVideoElement | null>(null)
const pictureInPicturePreview = ref<HTMLVideoElement | null>(null)
const cameraPreviewStream = shallowRef<MediaStream | null>(null)
const pictureInPictureSupported = ref(false)
const pictureInPictureActive = ref(false)
const pictureInPictureError = ref('')
const recording = ref(false)
const starting = ref(false)
const paused = ref(false)
const uploading = ref(false)
const includeMicrophone = ref(false)
const includeCamera = ref(false)
const includeSystemAudio = ref(true)
const source = ref<'screen' | 'camera'>('screen')
const quality = ref<'720p' | '1080p'>('720p')
const title = ref('')
const isPublic = ref(false)
const seconds = ref(0)
const error = ref('')
const status = ref('')
const captureWarnings = ref<string[]>([])
const resultUrl = ref('')
const resultBlob = shallowRef<Blob | null>(null)
const canRecordMedia = ref(false)
const canCaptureScreen = ref(false)
const canCaptureCamera = ref(false)
const recognitionSupported = ref(false)
const subtitleEnabled = ref(false)
const subtitleLanguage = ref('zh-CN')
const subtitleListening = ref(false)
const subtitleError = ref('')
const subtitleText = ref('')
const subtitleSegments = ref<SubtitleSegment[]>([])

let mediaRecorder: MediaRecorder | null = null
let activeStreams: MediaStream[] = []
let chunks: BlobPart[] = []
let timer: ReturnType<typeof setInterval> | undefined
let speechRestartTimer: ReturnType<typeof setTimeout> | undefined
let recognition: SpeechRecognitionLike | null = null
let drawFrame = 0
let previewPlayers: HTMLVideoElement[] = []
let disposed = false
let recordingStartedAt: number | null = null
let pausedAt: number | null = null
let totalPausedMs = 0

const durationLabel = computed(() => formatDuration(seconds.value))
const maxDuration = computed(() => {
  const configured = Number(runtime.public.recordingMaxDurationSeconds)
  return Number.isFinite(configured) && configured > 0 ? configured : recordingConfig.maxDurationSeconds
})
const supportMessage = computed(() => {
  if (!canRecordMedia.value) return t.value.devices.mediaRecorderUnsupported
  if (source.value === 'screen' && !canCaptureScreen.value) return t.value.devices.screenCaptureUnsupported
  if (source.value === 'camera' && !canCaptureCamera.value) return t.value.devices.cameraCaptureUnsupported
  return ''
})

onMounted(() => {
  const devices = navigator.mediaDevices
  const speech = window as SpeechWindow
  canRecordMedia.value = Boolean(devices && typeof MediaRecorder !== 'undefined')
  canCaptureScreen.value = Boolean(devices?.getDisplayMedia)
  canCaptureCamera.value = Boolean(devices?.getUserMedia)
  recognitionSupported.value = Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition)
})

function syncPictureInPictureState() {
  const video = pictureInPicturePreview.value as PictureInPictureVideo | null
  if (!video) return
  pictureInPictureActive.value = document.pictureInPictureElement === video || video.webkitPresentationMode === 'picture-in-picture'
}

function bindPictureInPictureEvents(video: HTMLVideoElement) {
  video.addEventListener('enterpictureinpicture', syncPictureInPictureState)
  video.addEventListener('leavepictureinpicture', syncPictureInPictureState)
  video.addEventListener('webkitpresentationmodechanged', syncPictureInPictureState)
  pictureInPictureSupported.value = Boolean(
    (document.pictureInPictureEnabled && typeof (video as PictureInPictureVideo).requestPictureInPicture === 'function')
    || ((video as PictureInPictureVideo).webkitSupportsPresentationMode?.('picture-in-picture')
      && (video as PictureInPictureVideo).webkitSetPresentationMode)
  )
  syncPictureInPictureState()
}

async function attachCameraPreview(stream: MediaStream | null) {
  cameraPreviewStream.value = stream
  pictureInPictureError.value = ''
  if (!stream) return

  await nextTick()
  const video = pictureInPicturePreview.value
  if (!video) return
  bindPictureInPictureEvents(video)
  video.srcObject = stream
  await video.play().catch(() => {
    pictureInPictureError.value = t.value.recording.pictureInPictureFailed
  })
}

async function togglePictureInPicture() {
  const video = pictureInPicturePreview.value as PictureInPictureVideo | null
  if (!video || !pictureInPictureSupported.value) return
  pictureInPictureError.value = ''

  try {
    if (pictureInPictureActive.value) {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture()
      else video.webkitSetPresentationMode?.('inline')
      pictureInPictureActive.value = false
    } else if (typeof video.requestPictureInPicture === 'function') {
      await video.requestPictureInPicture()
    } else {
      video.webkitSetPresentationMode?.('picture-in-picture')
    }
    syncPictureInPictureState()
  } catch {
    pictureInPictureError.value = t.value.recording.pictureInPictureFailed
  }
}

function chooseMimeType() {
  const options = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ]
  const selected = options.find(value => MediaRecorder.isTypeSupported?.(value))
  return selected ? { mimeType: selected } : undefined
}

function updateRecordingTime() {
  if (recordingStartedAt === null) return seconds.value
  const now = performance.now()
  const currentPause = pausedAt === null ? 0 : now - pausedAt
  seconds.value = Math.floor(Math.max(0, now - recordingStartedAt - totalPausedMs - currentPause) / 1000)
  return seconds.value
}

function resolution() {
  return quality.value === '1080p' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 }
}

async function getCaptureStream() {
  activeStreams = []
  let cameraStream: MediaStream | null = null
  if (source.value === 'screen') {
    const screen = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: includeSystemAudio.value
    })
    activeStreams.push(screen)
    if (includeSystemAudio.value && screen.getAudioTracks().length === 0) {
      captureWarnings.value.push(t.value.devices.systemAudioUnavailable)
    }
    const track = screen.getVideoTracks()[0]
    if (track?.applyConstraints) {
      const size = resolution()
      await track.applyConstraints({ width: { ideal: size.width }, height: { ideal: size.height } }).catch(() => undefined)
    }
  }

  if (source.value === 'camera' || includeCamera.value) {
    const size = resolution()
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: size.width }, height: { ideal: size.height } },
      audio: source.value === 'camera' && includeMicrophone.value
    })
    activeStreams.push(cameraStream)
  }
  if (source.value === 'screen' && includeMicrophone.value) {
    activeStreams.push(await navigator.mediaDevices.getUserMedia({ audio: true }))
  }

  const videoStreams = activeStreams.filter(stream => stream.getVideoTracks().length)
  const audioTracks = activeStreams.flatMap(stream => stream.getAudioTracks())
  if (videoStreams.length <= 1) {
    return {
      stream: new MediaStream([...videoStreams.flatMap(stream => stream.getVideoTracks()), ...audioTracks]),
      cameraStream
    }
  }

  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    captureWarnings.value.push(t.value.devices.cameraUnavailable)
    return {
      stream: new MediaStream([...videoStreams[0]!.getVideoTracks(), ...audioTracks]),
      cameraStream
    }
  }

  const canvas = document.createElement('canvas')
  const screenSettings = videoStreams[0]!.getVideoTracks()[0]!.getSettings()
  canvas.width = Math.max(640, screenSettings.width || resolution().width)
  canvas.height = Math.max(360, screenSettings.height || resolution().height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error(t.value.devices.cameraUnavailable)
  const players = videoStreams.map(stream => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    return video
  })
  previewPlayers = players
  await Promise.all(players.map(video => video.play()))
  const draw = () => {
    if (!context || !players[0]) return
    if (players[0].readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      context.drawImage(players[0], 0, 0, canvas.width, canvas.height)
    }
    if (players[1] && players[1].readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const width = Math.round(canvas.width * 0.24)
      const height = Math.round(width * 9 / 16)
      const inset = Math.round(canvas.width * 0.025)
      context.drawImage(players[1], canvas.width - width - inset, canvas.height - height - inset, width, height)
    }
    drawFrame = requestAnimationFrame(draw)
  }
  draw()
  const composite = canvas.captureStream(30)
  activeStreams.push(composite)
  return { stream: new MediaStream([...composite.getVideoTracks(), ...audioTracks]), cameraStream }
}

async function startRecording() {
  if (starting.value || recording.value || typeof window === 'undefined' || !navigator.mediaDevices) return
  starting.value = true
  error.value = ''
  status.value = ''
  captureWarnings.value = []
  subtitleError.value = ''
  clearRecordingResult()
  subtitleSegments.value = []
  subtitleText.value = ''

  try {
    // getDisplayMedia must stay in the direct user-gesture call chain.
    const { stream, cameraStream } = await getCaptureStream()
    await attachCameraPreview(cameraStream)
    if (activeStreams.some(active => active.getVideoTracks().some(track => track.readyState !== 'live'))) {
      throw new Error(t.value.recording.startFailed)
    }
    activeStreams.forEach(active => active.getVideoTracks().forEach(track => {
      track.addEventListener('ended', stopRecording, { once: true })
    }))
    chunks = []
    const options = chooseMimeType()
    mediaRecorder = new MediaRecorder(stream, {
      ...(options || {}),
      videoBitsPerSecond: quality.value === '1080p' ? 5_000_000 : 2_500_000
    })
    mediaRecorder.addEventListener('dataavailable', event => {
      if (event.data.size) chunks.push(event.data)
    })
    mediaRecorder.addEventListener('stop', finishRecording, { once: true })
    mediaRecorder.addEventListener('error', () => {
      error.value = t.value.recording.startFailed
      stopRecording()
    }, { once: true })
    mediaRecorder.start(1000)
    recording.value = true
    paused.value = false
    seconds.value = 0
    recordingStartedAt = performance.now()
    pausedAt = null
    totalPausedMs = 0
    status.value = t.value.recording.recordingStatus
    timer = setInterval(() => {
      if (updateRecordingTime() >= maxDuration.value) stopRecording()
    }, 1000)
    await nextTick()
    if (preview.value && source.value === 'screen') {
      preview.value.srcObject = stream
      await preview.value.play().catch(() => undefined)
    }
    if (subtitleEnabled.value) startSpeechRecognition()
  } catch (cause) {
    stopTracks()
    error.value = cause instanceof Error ? cause.message : t.value.permissions.screenDenied
  } finally {
    starting.value = false
  }
}

function clearRecordingResult() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  resultBlob.value = null
}

function pauseRecording() {
  if (!mediaRecorder) return
  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause()
    paused.value = true
    pausedAt = performance.now()
    updateRecordingTime()
    stopSpeechRecognition()
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume()
    if (pausedAt !== null) totalPausedMs += performance.now() - pausedAt
    pausedAt = null
    paused.value = false
    updateRecordingTime()
    if (subtitleEnabled.value) startSpeechRecognition()
  }
}

function stopRecording() {
  updateRecordingTime()
  if (timer) clearInterval(timer)
  timer = undefined
  recording.value = false
  paused.value = false
  recordingStartedAt = null
  pausedAt = null
  totalPausedMs = 0
  stopSpeechRecognition()
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
  stopTracks()
}

function stopTracks() {
  if (drawFrame) cancelAnimationFrame(drawFrame)
  drawFrame = 0
  const pipVideo = pictureInPicturePreview.value as PictureInPictureVideo | null
  if (pipVideo && document.pictureInPictureElement === pipVideo) {
    void document.exitPictureInPicture().catch(() => undefined)
  }
  if (pipVideo?.webkitPresentationMode === 'picture-in-picture') pipVideo.webkitSetPresentationMode?.('inline')
  for (const stream of activeStreams) stream.getTracks().forEach(track => track.stop())
  previewPlayers.forEach(video => {
    video.pause()
    video.srcObject = null
  })
  activeStreams = []
  previewPlayers = []
  if (preview.value) preview.value.srcObject = null
  if (pipVideo) {
    pipVideo.pause()
    pipVideo.srcObject = null
  }
  cameraPreviewStream.value = null
  pictureInPictureActive.value = false
}

function finishRecording() {
  if (disposed) return
  const mimeType = chunks.length && chunks[0] instanceof Blob ? (chunks[0] as Blob).type : 'video/webm'
  const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || mimeType })
  mediaRecorder = null
  if (!blob.size) {
    error.value = t.value.recording.startFailed
    status.value = ''
    return
  }
  resultBlob.value = blob
  resultUrl.value = URL.createObjectURL(blob)
  status.value = t.value.recording.recordingComplete
}

async function saveRecording() {
  if (!resultBlob.value || !user.value || uploading.value) return
  const blob = resultBlob.value
  const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
  const fileName = `${(title.value.trim() || 'soon-recording').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100)}.${extension}`
  uploading.value = true
  error.value = ''
  try {
    const saved = await upload({
      blob,
      fileName,
      title: title.value,
      quality: quality.value,
      duration: seconds.value,
      isPublic: isPublic.value,
      isPublish: false,
      onProgress: progress => { status.value = `${t.value.recording.uploading} ${progress}%` }
    })
    status.value = `${t.value.recording.uploadSuccess} ${saved.title}`
    clearRecordingResult()
    title.value = ''
    emit('uploaded')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value.fileUpload.uploadFailed
  } finally {
    uploading.value = false
  }
}

function downloadRecording() {
  if (!resultUrl.value || !resultBlob.value) return
  const link = document.createElement('a')
  link.href = resultUrl.value
  link.download = `${(title.value.trim() || 'soon-recording').replace(/[\\/:*?"<>|]+/g, '-')}.${resultBlob.value.type.includes('mp4') ? 'mp4' : 'webm'}`
  link.click()
}

function startSpeechRecognition() {
  if (!subtitleEnabled.value || !recording.value || paused.value) return
  if (!includeMicrophone.value) {
    subtitleError.value = t.value.subtitles.microphoneRequiredForSubtitles
    return
  }
  const speechWindow = window as SpeechWindow
  const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
  if (!Constructor) {
    recognitionSupported.value = false
    return
  }

  try {
    const next = new Constructor()
    recognition = next
    let restartAllowed = true
    next.continuous = true
    next.interimResults = true
    next.maxAlternatives = 1
    next.lang = subtitleLanguage.value
    next.onresult = (event) => {
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]!
        const text = result[0].transcript.trim()
        if (!text) continue
        if (result.isFinal) {
          const end = seconds.value
          const start = Math.max(0, end - Math.min(5, Math.max(1, text.length * 0.1)))
          subtitleSegments.value.push({ start, end: Math.max(end, start + 0.5), text })
          subtitleText.value = ''
        } else {
          interim += text
        }
      }
      if (interim) subtitleText.value = interim
    }
    next.onerror = (event) => {
      subtitleError.value = t.value.subtitles.recognitionStartFailed
      subtitleListening.value = false
      const reason = (event as SpeechRecognitionErrorEvent).error
      if (reason === 'not-allowed' || reason === 'service-not-allowed' || reason === 'audio-capture') {
        restartAllowed = false
      }
    }
    next.onend = () => {
      subtitleListening.value = false
      if (recognition === next) recognition = null
      if (restartAllowed && recording.value && !paused.value && subtitleEnabled.value && !disposed) {
        if (speechRestartTimer) clearTimeout(speechRestartTimer)
        speechRestartTimer = setTimeout(startSpeechRecognition, 500)
      }
    }
    next.start()
    subtitleListening.value = true
    subtitleError.value = ''
  } catch {
    recognition = null
    subtitleListening.value = false
    subtitleError.value = t.value.subtitles.recognitionStartFailed
  }
}

function stopSpeechRecognition() {
  if (speechRestartTimer) clearTimeout(speechRestartTimer)
  speechRestartTimer = undefined
  const current = recognition
  recognition = null
  subtitleListening.value = false
  if (current) {
    current.onresult = null
    current.onerror = null
    current.onend = null
    try { current.stop() } catch { /* Browser may already have stopped it. */ }
  }
}

function formatSubtitleTime(value: number, separator: ',' | '.') {
  const totalMs = Math.max(0, Math.floor(value * 1000))
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const secondsPart = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}${separator}${String(ms).padStart(3, '0')}`
}

function exportSubtitles(format: 'srt' | 'vtt') {
  if (!subtitleSegments.value.length) {
    error.value = t.value.subtitles.noSubtitlesToExport
    return
  }
  const separator = format === 'srt' ? ',' : '.'
  const entries = subtitleSegments.value.map((segment, index) => {
    const start = formatSubtitleTime(segment.start, separator)
    const end = formatSubtitleTime(segment.end, separator)
    return `${index + 1}\n${start} --> ${end}\n${segment.text}`
  }).join('\n\n')
  const content = format === 'vtt' ? `WEBVTT\n\n${entries}\n` : `${entries}\n`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${(title.value.trim() || 'soon-recording').replace(/[\\/:*?"<>|]+/g, '-')}.${format}`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

watch(subtitleEnabled, (enabled) => {
  if (!enabled) {
    subtitleError.value = ''
    stopSpeechRecognition()
  } else if (recording.value) {
    startSpeechRecognition()
  }
})

onBeforeUnmount(() => {
  disposed = true
  if (timer) clearInterval(timer)
  stopSpeechRecognition()
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
  stopTracks()
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">{{ t.dashboard.recordVideo }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t.recording.screenCaptureHint }}</p>
      </div>
    </template>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="space-y-4">
        <video v-if="recording && source === 'screen'" ref="preview" autoplay muted playsinline class="aspect-video w-full rounded-lg bg-black" />
        <video v-else-if="resultUrl" :src="resultUrl" controls playsinline class="aspect-video w-full rounded-lg bg-black" />
        <div v-else class="flex aspect-video items-center justify-center rounded-lg bg-elevated text-center text-muted">
          {{ t.recording.previewPlaceholder }}
        </div>

        <div class="flex flex-wrap items-center gap-3" role="status" aria-live="polite">
          <span v-if="recording" class="font-mono text-lg tabular-nums">{{ durationLabel }}</span>
          <UBadge v-if="status" color="neutral" variant="subtle">{{ status }}</UBadge>
        </div>

        <UAlert v-if="supportMessage" color="warning" variant="soft" :title="supportMessage" />
        <UAlert v-for="warning in captureWarnings" :key="warning" color="warning" variant="soft" :title="warning" />
        <UAlert v-if="error" color="error" variant="soft" :title="error" />
        <UAlert v-if="subtitleError" color="warning" variant="soft" :title="subtitleError" />

        <section v-if="recording && subtitleEnabled" class="space-y-2 rounded-lg bg-elevated p-3" aria-live="polite">
          <div class="flex items-center gap-2 text-sm font-medium">
            <span>{{ t.subtitles.liveSubtitles }}</span>
            <UBadge v-if="subtitleListening" color="success" variant="subtle">{{ t.subtitles.listening }}</UBadge>
          </div>
          <p v-if="subtitleText" class="text-sm">{{ subtitleText }}</p>
          <p v-for="(segment, index) in subtitleSegments.slice(-3)" :key="`${segment.start}-${index}`" class="text-sm text-muted">
            {{ segment.text }}
          </p>
          <p v-if="!subtitleText && !subtitleSegments.length" class="text-sm text-muted">{{ t.subtitles.waitingForSpeech }}</p>
        </section>

        <div class="flex flex-wrap gap-2">
          <UButton v-if="!recording && !resultBlob" :loading="starting" :disabled="Boolean(supportMessage) || uploading || starting" @click="startRecording">
            {{ t.recording.start }}
          </UButton>
          <UButton v-if="recording" color="neutral" variant="outline" @click="pauseRecording">
            {{ paused ? t.recording.resume : t.recording.pause }}
          </UButton>
          <UButton v-if="recording" color="error" @click="stopRecording">{{ t.recording.stop }}</UButton>
          <UButton v-if="resultBlob" color="neutral" variant="outline" @click="downloadRecording">{{ t.recording.download }}</UButton>
          <UButton v-if="resultBlob && user" :loading="uploading" @click="saveRecording">{{ t.recording.upload }}</UButton>
          <UButton v-if="resultBlob && subtitleSegments.length" color="neutral" variant="outline" @click="exportSubtitles('srt')">{{ t.subtitles.exportSrt }}</UButton>
          <UButton v-if="resultBlob && subtitleSegments.length" color="neutral" variant="outline" @click="exportSubtitles('vtt')">{{ t.subtitles.exportVtt }}</UButton>
          <UButton v-if="resultBlob" color="neutral" variant="ghost" :disabled="uploading" @click="clearRecordingResult">{{ t.recording.startNewRecording }}</UButton>
        </div>
        <p v-if="resultBlob && !user" class="text-sm text-muted">
          {{ t.guest.loginPrompt }} <NuxtLink to="/sign-in" class="text-primary underline">{{ t.auth.signIn }}</NuxtLink>
        </p>
      </div>

      <div class="space-y-4">
        <UFormField :label="t.recording.recordingSource">
          <USelect v-model="source" :items="[
            { label: t.recording.screenSource, value: 'screen' },
            { label: t.recording.cameraOnly, value: 'camera' }
          ]" class="w-full" :disabled="starting || recording || Boolean(resultBlob)" />
        </UFormField>
        <UFormField :label="t.recording.recordingQuality">
          <USelect v-model="quality" :items="[
            { label: '720p (1280 × 720)', value: '720p' },
            { label: '1080p (1920 × 1080)', value: '1080p' }
          ]" class="w-full" :disabled="starting || recording || Boolean(resultBlob)" />
        </UFormField>
        <UFormField :label="t.recording.videoTitle">
          <UInput v-model="title" :placeholder="t.recording.videoTitlePlaceholder" :disabled="recording || uploading" class="w-full" />
        </UFormField>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="includeSystemAudio" type="checkbox" :disabled="starting || recording || uploading || source === 'camera'">
          {{ t.recording.includeAudio }}
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="includeMicrophone" type="checkbox" :disabled="starting || recording || uploading">
          {{ t.recording.openMicrophone }}
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="includeCamera" type="checkbox" :disabled="starting || recording || uploading || source === 'camera' || Boolean(resultBlob)">
          {{ t.recording.includeCamera }}
        </label>
        <UAlert
          v-if="source === 'screen'"
          color="info"
          variant="soft"
          :title="includeCamera ? t.recording.crossPageCameraHint : t.recording.cameraNotIncludedHint"
        />
        <label class="flex items-center gap-2 text-sm">
          <input v-model="subtitleEnabled" type="checkbox" :disabled="starting || recording || uploading">
          {{ t.subtitles.enableSubtitles }}
        </label>
        <UFormField v-if="subtitleEnabled" :label="t.subtitles.subtitleLanguage">
          <USelect v-model="subtitleLanguage" :items="[
            { label: '简体中文', value: 'zh-CN' },
            { label: 'English', value: 'en-US' }
          ]" class="w-full" :disabled="recording" />
        </UFormField>
        <UAlert v-if="subtitleEnabled && !recognitionSupported" color="warning" variant="soft" :title="t.subtitles.speechNotSupported" />
        <label v-if="user" class="flex items-center gap-2 text-sm">
          <input v-model="isPublic" type="checkbox" :disabled="recording || Boolean(resultBlob)">
          {{ t.recording.publicVideo }}
        </label>
        <p class="text-xs leading-relaxed text-muted">{{ t.devices.browserSupportNote }}</p>
      </div>
    </div>
  </UCard>

  <div
    v-if="cameraPreviewStream"
    class="fixed bottom-4 right-4 z-50 w-56 overflow-hidden rounded-xl border border-default bg-default shadow-xl sm:w-64"
  >
    <video
      v-if="cameraPreviewStream"
      ref="pictureInPicturePreview"
      autoplay
      :controls="!pictureInPictureSupported"
      muted
      playsinline
      class="aspect-video w-full bg-black object-cover"
      :aria-label="t.recording.cameraPreview"
    />
    <div class="flex flex-wrap items-center justify-between gap-2 p-2">
      <span class="font-mono text-sm tabular-nums" role="timer">{{ durationLabel }}</span>
      <UButton size="xs" color="neutral" variant="outline" :disabled="!pictureInPictureSupported" @click="togglePictureInPicture">
        {{ pictureInPictureActive ? t.recording.closePictureInPicture : t.recording.openPictureInPicture }}
      </UButton>
    </div>
    <p v-if="source === 'screen' && !pictureInPictureActive" class="px-2 pb-2 text-xs text-muted">
      {{ t.recording.pictureInPictureHint }}
    </p>
    <p v-if="cameraPreviewStream && pictureInPictureError" class="px-2 pb-2 text-xs text-error">{{ pictureInPictureError }}</p>
    <p v-else-if="cameraPreviewStream && !pictureInPictureSupported" class="px-2 pb-2 text-xs text-muted">{{ t.recording.pictureInPictureUnavailable }}</p>
  </div>
</template>
