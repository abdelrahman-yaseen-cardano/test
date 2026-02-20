import { memo, useRef, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { useStore } from '../store/useStore'
import type { VideoFlowNodeData } from '../types'

// ──────────────────────────────────────────────
// Frame thumbnail panel
// ──────────────────────────────────────────────

function FramePanel({
  url,
  label,
  onPreview,
}: {
  url: string
  label: string
  onPreview: () => void
}) {
  return (
    <button
      onClick={onPreview}
      title={`Preview ${label}`}
      className="
        flex-none w-24 h-[68px] overflow-hidden rounded
        bg-black/40 border border-border
        hover:border-primary hover:scale-105
        transition-all duration-150 group relative
      "
    >
      <img
        src={url}
        alt={label}
        className="w-full h-full object-cover"
        draggable={false}
      />
      <div className="
        absolute inset-0 flex items-center justify-center
        opacity-0 group-hover:opacity-100 bg-black/55
        transition-opacity text-[10px] font-mono text-white
      ">
        {label}
      </div>
    </button>
  )
}

// ──────────────────────────────────────────────
// Big central video panel
// ──────────────────────────────────────────────

function VideoPanel({
  url,
  name,
  onOpenPreview,
}: {
  url: string
  name: string
  onOpenPreview: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else { v.play(); setPlaying(true) }
  }

  return (
    <div
      className="
        relative w-full rounded-lg overflow-hidden
        bg-black border border-border group cursor-pointer
      "
      style={{ height: 192 }}
    >
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        loop
        muted
        preload="metadata"
        onEnded={() => setPlaying(false)}
      />

      {/* Hover controls */}
      <div className="
        absolute inset-0 flex items-center justify-center gap-3
        bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity
      ">
        <button
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/35 flex items-center justify-center transition-colors"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenPreview() }}
          className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/35 flex items-center justify-center transition-colors"
          title="Open full preview"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Default idle indicator */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-10 h-10 text-white/40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Knob handle
// ──────────────────────────────────────────────

function KnobHandle({
  nodeId,
  side,
  state,
  onKnobClick,
}: {
  nodeId: string
  side: 'left' | 'right'
  state: 'normal' | 'active' | 'compatible' | 'dimmed'
  onKnobClick: (nodeId: string, side: 'left' | 'right') => void
}) {
  const position = side === 'left' ? Position.Left : Position.Right
  const handleType = side === 'left' ? ('target' as const) : ('source' as const)

  const handleClass = clsx('!w-4 !h-4 !rounded-full !border-2 !transition-all !duration-150', {
    '!bg-indigo-500 !border-indigo-400': state === 'normal',
    'handle-active': state === 'active',
    'handle-compatible': state === 'compatible',
    'handle-dimmed': state === 'dimmed',
  })

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const startX = e.clientX
      const startY = e.clientY
      const onUp = (upE: MouseEvent) => {
        const dx = Math.abs(upE.clientX - startX)
        const dy = Math.abs(upE.clientY - startY)
        if (dx < 4 && dy < 4) onKnobClick(nodeId, side)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mouseup', onUp)
    },
    [nodeId, side, onKnobClick],
  )

  return (
    <Handle
      type={handleType}
      position={position}
      id={side}
      className={handleClass}
      onMouseDown={onMouseDown}
    />
  )
}

// ──────────────────────────────────────────────
// VideoNode
// ──────────────────────────────────────────────

export const VideoNode = memo(function VideoNode({ data, id, selected }: NodeProps) {
  const nodeData = data as VideoFlowNodeData
  const { onPreviewFrame, onPreviewVideo, onRename, onDelete, onAddToTimeline, timelinePositions } = nodeData

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(nodeData.name)

  const activeKnob = useStore((s) => s.activeKnob)
  const compatibleHandles = useStore((s) => s.compatibleHandles)
  const triggerKnob = useStore((s) => s.triggerKnob)

  const getHandleState = (side: 'left' | 'right') => {
    if (!activeKnob) return 'normal'
    if (activeKnob.nodeId === id && activeKnob.side === side) return 'active'
    const isCompatible = compatibleHandles.some((h) => h.nodeId === id && h.side === side)
    if (isCompatible) return 'compatible'
    return 'dimmed'
  }

  const commitRename = () => {
    if (draftName.trim() && draftName !== nodeData.name) onRename(id, draftName.trim())
    setEditing(false)
  }

  // Show filename subtitle only when it meaningfully differs from the current name
  const ext = nodeData.originalFilename?.split('.').pop() ?? ''
  const stemFromOriginal = nodeData.originalFilename?.replace(`.${ext}`, '') ?? ''
  const showFilename = nodeData.originalFilename && stemFromOriginal !== nodeData.name

  return (
    <div
      className={clsx(
        'select-none rounded-xl border transition-all duration-150',
        'bg-surface shadow-lg',
        selected ? 'border-primary shadow-primary/20 shadow-lg' : 'border-border',
        'hover:border-primary/50',
      )}
      style={{ minWidth: 380 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-3 pt-2 pb-2 border-b border-border gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          {/* Timeline position badges */}
          {timelinePositions && timelinePositions.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {timelinePositions.map((pos) => (
                <span
                  key={pos}
                  className="text-[9px] font-bold bg-success/20 text-success px-1.5 py-0.5 rounded-full leading-tight"
                >
                  #{pos + 1}
                </span>
              ))}
            </div>
          )}

          {/* Node name (double-click to rename) */}
          {editing ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => e.key === 'Enter' && commitRename()}
              className="bg-transparent border-b border-primary outline-none text-sm text-text font-medium w-44"
            />
          ) : (
            <span
              className="text-sm font-medium text-text cursor-pointer hover:text-primary transition-colors truncate"
              onDoubleClick={() => { setDraftName(nodeData.name); setEditing(true) }}
              title="Double-click to rename"
            >
              {nodeData.name}
            </span>
          )}

          {/* Original filename subtitle */}
          {showFilename && (
            <span className="text-[10px] text-textMuted font-mono truncate mt-0.5 opacity-70" title={nodeData.originalFilename}>
              {nodeData.originalFilename}
            </span>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <span className="text-xs text-textMuted font-mono">{nodeData.duration.toFixed(2)}s</span>
          <span className="text-xs text-textMuted font-mono hidden xl:inline">{nodeData.width}×{nodeData.height}</span>
          <button
            onClick={() => onAddToTimeline(id)}
            className="
              text-[10px] px-1.5 py-0.5 rounded font-semibold
              bg-success/10 border border-success/30 text-success
              hover:bg-success/25 transition-colors
            "
            title="Add to linear timeline"
          >
            +TL
          </button>
          <button
            onClick={() => onDelete(id)}
            className="text-muted hover:text-danger transition-colors text-xs"
            title="Delete node"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Big central video panel */}
      <div className="px-3 pt-3 pb-2">
        <VideoPanel
          url={nodeData.videoUrl}
          name={nodeData.name}
          onOpenPreview={() => onPreviewVideo(nodeData.videoUrl, nodeData.name)}
        />
      </div>

      {/* Frame thumbnails at the bottom */}
      <div className="flex items-center justify-between px-3 pb-3">
        <FramePanel
          url={nodeData.firstFrameUrl}
          label="First Frame"
          onPreview={() => onPreviewFrame(nodeData.firstFrameUrl, `${nodeData.name} — First Frame`)}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-0.5 px-2">
          <div className="w-full h-px bg-border/60" />
          <span className="text-[9px] text-textMuted font-mono opacity-60">transitions</span>
        </div>
        <FramePanel
          url={nodeData.lastFrameUrl}
          label="Last Frame"
          onPreview={() => onPreviewFrame(nodeData.lastFrameUrl, `${nodeData.name} — Last Frame`)}
        />
      </div>

      {/* Connection handles */}
      <KnobHandle nodeId={id} side="left" state={getHandleState('left')} onKnobClick={triggerKnob} />
      <KnobHandle nodeId={id} side="right" state={getHandleState('right')} onKnobClick={triggerKnob} />
    </div>
  )
})