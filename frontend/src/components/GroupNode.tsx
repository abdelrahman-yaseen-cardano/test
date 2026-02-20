import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { useStore } from '../store/useStore'
import type { GroupFlowNodeData } from '../types'

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

  const cls = clsx('!w-4 !h-4 !rounded-full !border-2 !transition-all !duration-150', {
    '!bg-amber-500 !border-amber-400': state === 'normal',
    'handle-active': state === 'active',
    'handle-compatible': state === 'compatible',
    'handle-dimmed': state === 'dimmed',
  })

  const onMouseDown = (e: React.MouseEvent) => {
    const sx = e.clientX, sy = e.clientY
    const up = (ue: MouseEvent) => {
      if (Math.abs(ue.clientX - sx) < 4 && Math.abs(ue.clientY - sy) < 4) {
        onKnobClick(nodeId, side)
      }
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mouseup', up)
  }

  return <Handle type={handleType} position={position} id={side} className={cls} onMouseDown={onMouseDown} />
}

export const GroupNode = memo(function GroupNode({ data, id, selected }: NodeProps) {
  const nodeData = data as GroupFlowNodeData
  const { onPreviewFrame, onRename, onDelete, onUngroup, onExpand, onAddToTimeline, timelinePositions } = nodeData

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

  return (
    <div
      className={clsx(
        'select-none rounded-xl border transition-all duration-150 bg-surface shadow-lg',
        selected ? 'border-warning shadow-warning/20 shadow-lg' : 'border-warning/40',
        'hover:border-warning/70',
      )}
      style={{ minWidth: 360 }}
      onDoubleClick={(e) => {
        // Double-click on the body (not on a button or input) → expand
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('input')) return
        onExpand(id)
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-3 pt-2 pb-2 border-b border-warning/20 bg-warning/5 rounded-t-xl gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          {/* Timeline badges */}
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-warning uppercase tracking-wide">Group</span>
            {editing ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                className="bg-transparent border-b border-primary outline-none text-sm text-text font-medium w-36"
              />
            ) : (
              <span
                className="text-sm font-medium text-text cursor-pointer hover:text-warning transition-colors truncate max-w-[160px]"
                onDoubleClick={(e) => { e.stopPropagation(); setDraftName(nodeData.name); setEditing(true) }}
                title="Double-click to rename"
              >
                {nodeData.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <span className="text-xs text-textMuted font-mono">{nodeData.childIds.length} clips</span>
          <span className="text-xs text-textMuted font-mono">{nodeData.duration.toFixed(2)}s</span>
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
            onClick={() => onUngroup(id)}
            className="text-xs text-textMuted hover:text-warning transition-colors"
            title="Ungroup"
          >
            ⊞
          </button>
          <button
            onClick={() => onDelete(id)}
            className="text-xs text-muted hover:text-danger transition-colors"
            title="Delete group"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex items-center gap-2 p-3">
        {/* First frame */}
        <button
          onClick={() => onPreviewFrame(nodeData.firstFrameUrl, `${nodeData.name} — First Frame`)}
          className="flex-none w-28 h-20 rounded overflow-hidden border border-border hover:border-warning bg-black/40 transition-colors relative group"
        >
          <img src={nodeData.firstFrameUrl} alt="First" className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-xs text-white transition-opacity">First</div>
        </button>

        {/* Middle info — hint that double-clicking expands */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1 h-20">
          <div className="text-warning/60 text-4xl leading-none">⊻</div>
          <div className="text-xs text-textMuted text-center">
            {nodeData.childIds.length} segments<br />
            <span className="font-mono">{nodeData.duration.toFixed(2)}s total</span>
          </div>
          <span className="text-[9px] text-textMuted/60 italic">double-click to expand</span>
        </div>

        {/* Last frame */}
        <button
          onClick={() => onPreviewFrame(nodeData.lastFrameUrl, `${nodeData.name} — Last Frame`)}
          className="flex-none w-28 h-20 rounded overflow-hidden border border-border hover:border-warning bg-black/40 transition-colors relative group"
        >
          <img src={nodeData.lastFrameUrl} alt="Last" className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-xs text-white transition-opacity">Last</div>
        </button>
      </div>

      <KnobHandle nodeId={id} side="left" state={getHandleState('left')} onKnobClick={triggerKnob} />
      <KnobHandle nodeId={id} side="right" state={getHandleState('right')} onKnobClick={triggerKnob} />
    </div>
  )
})