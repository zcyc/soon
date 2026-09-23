import type { Video } from '~/utils/video'
import { getVideoMimeType, inspectVideoBlob } from '~/utils/video'

const MULTIPART_THRESHOLD = 64 * 1024 * 1024
const PART_SIZE = 32 * 1024 * 1024
const PART_CONCURRENCY = 3

interface UploadOptions {
  blob: Blob
  fileName: string
  title: string
  quality: string
  isPublic: boolean
  isPublish: boolean
  duration?: number
  onProgress?: (progress: number) => void
}

function putBlob(url: string, blob: Blob, contentType: string, onProgress?: (loaded: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    if (contentType) request.setRequestHeader('Content-Type', contentType)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded)
    }
    request.onerror = () => reject(new Error('Upload connection failed'))
    request.onabort = () => reject(new Error('Upload was cancelled'))
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Upload failed (${request.status})`))
        return
      }
      resolve(request.getResponseHeader('ETag') || '')
    }
    request.send(blob)
  })
}

export function useVideoUpload() {
  const { apiFetch } = useApi()

  async function upload(options: UploadOptions): Promise<Video> {
    const contentType = getVideoMimeType({ name: options.fileName, type: options.blob.type }) || 'video/webm'
    const preview = await inspectVideoBlob(options.blob)
    let fileId = ''
    let uploadId = ''
    let thumbnailFileId = ''

    try {
      if (options.blob.size > MULTIPART_THRESHOLD) {
        const started = await apiFetch<{ fileId: string; uploadId: string }>('uploads/multipart/start', {
          method: 'POST',
          body: { contentType, fileName: options.fileName, size: options.blob.size }
        })
        fileId = started.fileId
        uploadId = started.uploadId

        const partCount = Math.ceil(options.blob.size / PART_SIZE)
        const parts: { partNumber: number; etag: string }[] = new Array(partCount)
        const completedBytes = new Array<number>(partCount).fill(0)
        let nextPart = 0
        const updateProgress = () => {
          const sent = completedBytes.reduce((sum, value) => sum + value, 0)
          options.onProgress?.(Math.min(99, Math.floor(sent / options.blob.size * 100)))
        }

        const uploadNextPart = async () => {
          while (nextPart < partCount) {
            const index = nextPart++
            const partNumber = index + 1
            const signed = await apiFetch<{ url: string }>('uploads/multipart/part-url', {
              method: 'POST',
              body: { fileId, uploadId, partNumber }
            })
            const start = index * PART_SIZE
            const blob = options.blob.slice(start, Math.min(options.blob.size, start + PART_SIZE))
            const etag = await putBlob(signed.url, blob, '', (loaded) => {
              completedBytes[index] = loaded
              updateProgress()
            })
            if (!etag) throw new Error('Storage did not return an upload part tag')
            completedBytes[index] = blob.size
            parts[index] = { partNumber, etag }
            updateProgress()
          }
        }

        await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, partCount) }, uploadNextPart))
        await apiFetch('uploads/multipart/complete', {
          method: 'POST',
          body: { fileId, uploadId, parts }
        })
        uploadId = ''
      } else {
        const signed = await apiFetch<{ fileId: string; uploadUrl: string }>('uploads/sign', {
          method: 'POST',
          body: { contentType, fileName: options.fileName, size: options.blob.size }
        })
        fileId = signed.fileId
        await putBlob(signed.uploadUrl, options.blob, contentType, loaded => {
          options.onProgress?.(Math.min(99, Math.floor(loaded / options.blob.size * 100)))
        })
      }

      if (preview.thumbnail) {
        try {
          const signed = await apiFetch<{ fileId: string; uploadUrl: string }>('uploads/sign', {
            method: 'POST',
            body: { contentType: 'image/jpeg', fileName: 'thumbnail.jpg', size: preview.thumbnail.size }
          })
          thumbnailFileId = signed.fileId
          await putBlob(signed.uploadUrl, preview.thumbnail, 'image/jpeg')
        } catch (error) {
          console.warn('Video thumbnail upload failed; continuing without a thumbnail', error)
          if (thumbnailFileId) {
            await apiFetch('uploads/abort', { method: 'POST', body: { fileId: thumbnailFileId } }).catch(() => undefined)
            thumbnailFileId = ''
          }
        }
      }

      const saved = await apiFetch<{ video: Video }>('videos', {
        method: 'POST',
        body: {
          fileId,
          thumbnailFileId: thumbnailFileId || undefined,
          title: options.title.trim() || options.fileName.replace(/\.[^.]+$/, ''),
          duration: options.duration ?? preview.duration,
          quality: options.quality,
          isPublic: options.isPublic,
          isPublish: options.isPublish
        }
      })
      options.onProgress?.(100)
      return saved.video
    } catch (error) {
      if (fileId) {
        await apiFetch('uploads/abort', {
          method: 'POST',
          body: { fileId, ...(uploadId ? { uploadId } : {}) }
        }).catch(() => undefined)
      }
      if (thumbnailFileId) {
        await apiFetch('uploads/abort', { method: 'POST', body: { fileId: thumbnailFileId } }).catch(() => undefined)
      }
      throw error
    }
  }

  return { upload }
}
