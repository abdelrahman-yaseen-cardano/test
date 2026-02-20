import { ReactFlowProvider } from '@xyflow/react'
import { useStore } from './store/useStore'
import { NodeEditor } from './components/NodeEditor'
import { UploadZone } from './components/UploadZone'
import { FramePreviewModal } from './components/FramePreviewModal'
import { ExportPanel } from './components/ExportPanel'
import { LinearTimeline } from './components/LinearTimeline'
import { GroupExpandModal } from './components/GroupExpandModal'
import { VideoPreviewModal } from './components/VideoPreviewModal'

export default function App() {
  const showExport = useStore((s) => s.showExport)
  const setShowExport = useStore((s) => s.setShowExport)
  const showLinearTimeline = useStore((s) => s.showLinearTimeline)
  const setShowLinearTimeline = useStore((s) => s.setShowLinearTimeline)
  const expandedGroupId = useStore((s) => s.expandedGroupId)
  const timelineSlots = useStore((s) => s.timelineSlots)
  const ssimThreshold = useStore((s) => s.ssimThreshold)
  const setThreshold = useStore((s) => s.setThreshold)

  return (
    <div className="flex flex-col h-screen w-screen bg-bg text-text overflow-hidden">
      {/* ── Top Bar ──────────────────────────────────── */}
      <header className="flex-none flex items-center justify-between px-5 py-2.5 border-b border-border bg-surface z-20">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">⟳</span>
          <span className="text-sm font-bold tracking-tight text-text">Loop Engine</span>
          <span className="text-xs text-textMuted ml-1 font-mono">v1.0</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* SSIM threshold slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-textMuted">Similarity threshold</label>
            <input
              type="range"
              min={0.4}
              max={1.0}
              step={0.01}
              value={ssimThreshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-28 accent-primary"
            />
            <span className="text-xs font-mono text-text w-8">{ssimThreshold.toFixed(2)}</span>
          </div>

          {/* Timeline button */}
          <button
            onClick={() => setShowLinearTimeline(true)}
            className="
              px-4 py-1.5 rounded-lg text-xs font-semibold
              bg-surface border border-border text-text hover:bg-surfaceHover
              transition-colors flex items-center gap-1.5 relative
            "
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h8" />
            </svg>
            Timeline
            {timelineSlots.length > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-primary text-white rounded-full px-1.5 py-0">
                {timelineSlots.length}
              </span>
            )}
          </button>

          {/* Export button */}
          <button
            onClick={() => setShowExport(true)}
            className="
              px-4 py-1.5 rounded-lg text-xs font-semibold
              bg-primary text-white hover:bg-primaryHover
              transition-colors flex items-center gap-1.5
            "
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
          </button>
        </div>
      </header>

      {/* ── Main Layout ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex-none w-72 border-r border-border bg-surface flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold text-textMuted uppercase tracking-widest mb-3">Upload</h3>
            <UploadZone />
          </div>

          <div className="p-4 flex-1">
            <h3 className="text-xs font-semibold text-textMuted uppercase tracking-widest mb-3">Tips</h3>
            <ul className="text-xs text-textMuted space-y-2 leading-relaxed">
              <li>• Click any <span className="text-primary">●</span> knob to highlight compatible connections</li>
              <li>• <span className="text-text">Drag</span> from a knob to draw a connection edge</li>
              <li>• <span className="text-text">Double-click</span> a node name to rename it</li>
              <li>• <span className="text-text">Shift+click</span> to multi-select nodes, then group them</li>
              <li>• A node can connect to <span className="text-success">itself</span> if first ≈ last frame</li>
              <li>• Adjust threshold slider to change matching strictness</li>
              <li>• <span className="text-text">Double-click</span> a group to expand its contents</li>
              <li>• Click <span className="text-primary">+TL</span> on a node to add it to the linear timeline</li>
              <li>• Open <span className="text-text">Timeline</span> to reorder, duplicate, or validate the sequence</li>
            </ul>
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 relative">
          <ReactFlowProvider>
            <NodeEditor />
          </ReactFlowProvider>
        </main>
      </div>

      {/* ── Modals ────────────────────────────────────── */}
      <FramePreviewModal />
      <VideoPreviewModal />
      {expandedGroupId && <GroupExpandModal />}
      {showLinearTimeline && <LinearTimeline onClose={() => setShowLinearTimeline(false)} />}
      {showExport && <ExportPanel onClose={() => setShowExport(false)} />}
    </div>
  )
}
