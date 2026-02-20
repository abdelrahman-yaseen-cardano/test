import { useCallback, useState } from 'react'
import { useStore } from '../store/useStore'

export function UploadZone() {
  const uploadVideos = useStore((s) => s.uploadVideos)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const videoFiles = Array.from(files).filter((f) =>
        f.type.startsWith('video/'),
      )
      if (!videoFiles.length) {
        setError('No video files detected.')
        return
      }
      setUploading(true)
      setError(null)
      try {
        await uploadVideos(videoFiles)
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? e.message ?? 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [uploadVideos],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
        transition-all duration-200
        ${dragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-border bg-surface hover:border-primary/50 hover:bg-surfaceHover'}
      `}
    >
      <input
        type="file"
        multiple
        accept="video/*"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        disabled={uploading}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-textMuted">Uploading & extracting frames…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <svg className="w-10 h-10 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-text font-medium">Drop videos here or click to browse</p>
          <p className="text-xs text-textMuted">Bulk upload supported · MP4, MOV, WebM, AVI…</p>
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-danger">{error}</p>
      )}
    </div>
  )
}
