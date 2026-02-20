import { useStore } from '../store/useStore'

export function FramePreviewModal() {
  const previewFrame = useStore((s) => s.previewFrame)
  const close = useStore((s) => s.closeFramePreview)

  if (!previewFrame) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] rounded-xl overflow-hidden border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
          <span className="text-sm font-medium text-text">{previewFrame.label}</span>
          <button onClick={close} className="text-muted hover:text-text transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <img
          src={previewFrame.url}
          alt={previewFrame.label}
          className="max-w-full max-h-[80vh] object-contain bg-black"
        />
      </div>
    </div>
  )
}
