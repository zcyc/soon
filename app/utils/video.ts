export interface Video {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  fileId: string
  quality: string
  userId: string
  userName: string
  duration: number
  views: number
  isPublic: boolean
  isPublish: boolean
  thumbnailUrl: string
  subtitleFileId: string | null
}

export function formatDuration(duration: number): string {
  const seconds = Math.max(0, Math.floor(duration))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const VIDEO_MIME_TYPES: Record<string, string> = {
  avi: 'video/x-msvideo',
  m4v: 'video/x-m4v',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  webm: 'video/webm',
  '3gp': 'video/3gpp'
}

export function getVideoMimeType(file: Pick<File, 'name' | 'type'>): string {
  if (file.type.startsWith('video/')) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  return VIDEO_MIME_TYPES[extension] || ''
}

export interface VideoPreviewMetadata {
  duration: number
  thumbnail: Blob | null
}

export function inspectVideoBlob(blob: Blob): Promise<VideoPreviewMetadata> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return Promise.resolve({ duration: 0, thumbnail: null })
  }

  const sourceUrl = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true

  return new Promise((resolve) => {
    let settled = false
    const timeout = window.setTimeout(() => finish(null), 10000)

    const finish = (thumbnail: Blob | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0
      video.onloadedmetadata = null
      video.onloadeddata = null
      video.onseeked = null
      video.onerror = null
      video.pause()
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(sourceUrl)
      resolve({ duration, thumbnail })
    }

    const captureFrame = () => {
      if (settled) return
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return

      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      const context = canvas.getContext('2d')
      if (!context || typeof canvas.toBlob !== 'function') return finish(null)

      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight)
      const width = Math.round(video.videoWidth * scale)
      const height = Math.round(video.videoHeight * scale)
      context.fillStyle = '#000'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
      canvas.toBlob(finish, 'image/jpeg', 0.82)
    }

    video.onloadedmetadata = () => {
      const targetTime = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, video.duration / 2)
        : 0
      try {
        video.currentTime = targetTime
        if (targetTime === 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) captureFrame()
      } catch {
        captureFrame()
      }
    }
    video.onloadeddata = () => {
      if (video.currentTime === 0) captureFrame()
    }
    video.onseeked = captureFrame
    video.onerror = () => finish(null)
    video.src = sourceUrl
    video.load()
  })
}
