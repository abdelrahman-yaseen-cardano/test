/**
 * VideoPreviewModal
 *
 * Shown when the user clicks the fullscreen preview button on a VideoNode.
 * Plays the video in a modal overlay.
 */

import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

export function VideoPreviewModal() {
  const previewVideo = useStore((s) => s.previewVideo)
  const closeVideoPreview = useStore((s) => s.closeVideoPreview)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Auto-play when modal opens
  useEffect(() => {
    if (previewVideo && videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [previewVideo])

  // Close on Escape
  useEffect(() => {
    if (!previewVideo) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeVideoPreview() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewVideo, closeVideoPreview])

  if (!previewVideo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={closeVideoPreview}
    >
      <div
        className="
          relative flex flex-col rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden
          max-w-[90vw] max-h-[90vh]
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <span className="text-sm font-medium text-text truncate max-w-[60vw]" title={previewVideo.name}>
            {previewVideo.name}
          </span>
          <button
            onClick={closeVideoPreview}
            className="ml-4 text-textMuted hover:text-text transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video */}
        <div className="flex items-center justify-center bg-black" style={{ maxHeight: 'calc(90vh - 60px)' }}>
          <video
            ref={videoRef}
            src={previewVideo.url}
            controls
            loop
            className="max-w-full max-h-full"
            style={{ maxHeight: 'calc(90vh - 60px)' }}
          />
        </div>
      </div>
    </div>
  )
}
