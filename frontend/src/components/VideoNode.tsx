import { memo, useRef, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { useStore } from '../store/useStore'
import type { VideoFlowNodeData } from '../types'

// ──────────────────────────────────────────────
// Sub-components
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
        flex-none w-28 h-20 overflow-hidden rounded
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
        opacity-0 group-hover:opacity-100 bg-black/50
        transition-opacity text-xs font-mono text-text
      ">
        {label}
      </div>
    </button>
  )
}

function VideoPanel({ url, name }: { url: string; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else { v.play(); setPlaying(true) }
  }

  return (
    <div
      onClick={toggle}
      className="
        relative flex-none w-40 h-20 rounded overflow-hidden
        bg-black border border-border cursor-pointer
        hover:border-primary transition-colors group
      "
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
      {!playing && (
        <div className="
          absolute inset-0 flex items-center justify-center
          bg-black/40 group-hover:bg-black/60 transition-colors
        ">
          <svg className="w-8 h-8 text-white/80" viewBox="0 0 24 24" fill="currentColor">
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
      // Only trigger "click" mode if the mouse doesn't move (not a drag)
      const startX = e.clientX
      const startY = e.clientY
      const onUp = (upE: MouseEvent) => {
        const dx = Math.abs(upE.clientX - startX)
        const dy = Math.abs(upE.clientY - startY)
        if (dx < 4 && dy < 4) {
          onKnobClick(nodeId, side)
        }
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
  const { onPreviewFrame, onRename, onDelete } = nodeData

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(nodeData.name)

  const activeKnob = useStore((s) => s.activeKnob)
  const compatibleHandles = useStore((s) => s.compatibleHandles)
  const triggerKnob = useStore((s) => s.triggerKnob)

  const getHandleState = (side: 'left' | 'right') => {
    if (!activeKnob) return 'normal'
    if (activeKnob.nodeId === id && activeKnob.side === side) return 'active'
    const isCompatible = compatibleHandles.some(
      (h) => h.nodeId === id && h.side === side,
    )
    if (isCompatible) return 'compatible'
    return 'dimmed'
  }

  const commitRename = () => {
    if (draftName.trim() && draftName !== nodeData.name) {
      onRename(id, draftName.trim())
    }
    setEditing(false)
  }

  return (
    <div
      className={clsx(
        'select-none rounded-xl border transition-all duration-150',
        'bg-surface shadow-lg',
        selected ? 'border-primary shadow-primary/20 shadow-lg' : 'border-border',
        'hover:border-primary/50',
      )}
      style={{ minWidth: 340 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        {editing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => e.key === 'Enter' && commitRename()}
            className="
              bg-transparent border-b border-primary outline-none
              text-sm text-text font-medium w-40
            "
          />
        ) : (
          <span
            className="text-sm font-medium text-text cursor-pointer hover:text-primary transition-colors truncate max-w-[180px]"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {nodeData.name}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-textMuted font-mono">
            {nodeData.duration.toFixed(2)}s
          </span>
          <span className="text-xs text-textMuted font-mono">
            {nodeData.width}×{nodeData.height}
          </span>
          <button
            onClick={() => onDelete(id)}
            className="text-muted hover:text-danger transition-colors text-xs ml-1"
            title="Delete node"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex items-center gap-2 p-3">
        <FramePanel
          url={nodeData.firstFrameUrl}
          label="First Frame"
          onPreview={() => onPreviewFrame(nodeData.firstFrameUrl, `${nodeData.name} — First Frame`)}
        />
        <VideoPanel url={nodeData.videoUrl} name={nodeData.name} />
        <FramePanel
          url={nodeData.lastFrameUrl}
          label="Last Frame"
          onPreview={() => onPreviewFrame(nodeData.lastFrameUrl, `${nodeData.name} — Last Frame`)}
        />
      </div>

      {/* Handles */}
      <KnobHandle nodeId={id} side="left" state={getHandleState('left')} onKnobClick={triggerKnob} />
      <KnobHandle nodeId={id} side="right" state={getHandleState('right')} onKnobClick={triggerKnob} />
    </div>
  )
})
