/**
 * LinearTimeline
 *
 * Shows the single linear playback sequence that the user is building.
 * Rules enforced visually:
 *  - Slot 0 (first) is always marked compatible (it has no predecessor).
 *  - Every following slot is checked: the LAST frame of slot[i-1] must match
 *    the FIRST frame of slot[i] (using the similarity matrix).
 *  - Incompatible transitions are highlighted in red.
 *  - The very first slot is allowed to differ from the last slot (wrap-around
 *    is NOT enforced — only inner transitions must match).
 *
 * Interaction:
 *  - Reorder via ← → arrow buttons.
 *  - Duplicate a slot (same nodeId, new slotId) via ⎘.
 *  - Remove a slot via ✕.
 *  - Export the timeline => flattened list with original_filename.
 */

import { useMemo } from 'react'
import clsx from 'clsx'
import { useStore } from '../store/useStore'
import type { TimelineSlot } from '../types'

function SlotCard({
  slot,
  position,
  name,
  firstFrameUrl,
  lastFrameUrl,
  duration,
  compatScore,
  isFirst,
  onMoveLeft,
  onMoveRight,
  onDuplicate,
  onRemove,
}: {
  slot: TimelineSlot
  position: number
  name: string
  firstFrameUrl: string
  lastFrameUrl: string
  duration: number
  compatScore: number
  isFirst: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const threshold = useStore((s) => s.ssimThreshold)
  const compatible = isFirst || compatScore >= threshold

  return (
    <div className="relative flex flex-col items-center">
      {/* Compatibility indicator (transition INTO this slot) */}
      {!isFirst && (
        <div className={clsx(
          'absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-0.5 z-10',
          compatible ? 'bg-success' : 'bg-danger',
        )}>
          <div className={clsx(
            'absolute -top-2.5 left-0 text-[9px] font-bold whitespace-nowrap',
            compatible ? 'text-success' : 'text-danger',
          )}>
            {compatible ? `✓ ${(compatScore * 100).toFixed(0)}%` : `✗ ${(compatScore * 100).toFixed(0)}%`}
          </div>
        </div>
      )}

      {/* Card */}
      <div className={clsx(
        'relative flex flex-col w-36 rounded-xl border transition-all duration-150 bg-surface shadow',
        compatible ? 'border-border' : 'border-danger bg-danger/5',
      )}>
        {/* Position badge */}
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20">
          <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">#{position + 1}</span>
        </div>

        {/* Frames */}
        <div className="flex gap-1 p-2 pt-4">
          <img src={firstFrameUrl} className="w-14 h-10 object-cover rounded border border-border/50" alt="first" />
          <img src={lastFrameUrl} className="w-14 h-10 object-cover rounded border border-border/50" alt="last" />
        </div>

        {/* Info */}
        <div className="px-2 pb-1 text-center">
          <div className="text-xs text-text font-medium truncate" title={name}>{name}</div>
          <div className="text-[10px] text-textMuted font-mono">{duration.toFixed(2)}s</div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-1 px-2 pb-2">
          <button
            onClick={onMoveLeft}
            className="w-6 h-6 flex items-center justify-center rounded bg-surface hover:bg-surfaceHover text-textMuted hover:text-text transition-colors text-xs"
            title="Move left"
          >
            ‹
          </button>
          <button
            onClick={onDuplicate}
            className="w-6 h-6 flex items-center justify-center rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs"
            title="Duplicate slot (same node)"
          >
            ⎘
          </button>
          <button
            onClick={onMoveRight}
            className="w-6 h-6 flex items-center justify-center rounded bg-surface hover:bg-surfaceHover text-textMuted hover:text-text transition-colors text-xs"
            title="Move right"
          >
            ›
          </button>
          <button
            onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center rounded bg-danger/10 hover:bg-danger/20 text-danger transition-colors text-xs"
            title="Remove from timeline"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

export function LinearTimeline({ onClose }: { onClose: () => void }) {
  const nodes = useStore((s) => s.nodes)
  const timelineSlots = useStore((s) => s.timelineSlots)
  const moveSlotLeft = useStore((s) => s.moveSlotLeft)
  const moveSlotRight = useStore((s) => s.moveSlotRight)
  const duplicateInTimeline = useStore((s) => s.duplicateInTimeline)
  const removeFromTimeline = useStore((s) => s.removeFromTimeline)
  const getCompatibility = useStore((s) => s.getTimelineCompatibility)
  const ssimThreshold = useStore((s) => s.ssimThreshold)

  const compatibility = getCompatibility()

  // Build node-data lookup
  const nodeMap = useMemo(() => {
    const m: Record<string, { name: string; firstFrameUrl: string; lastFrameUrl: string; duration: number }> = {}
    nodes.forEach((n) => {
      m[n.id] = {
        name: (n.data as any).name ?? n.id,
        firstFrameUrl: (n.data as any).firstFrameUrl ?? '',
        lastFrameUrl: (n.data as any).lastFrameUrl ?? '',
        duration: (n.data as any).duration ?? 0,
      }
    })
    return m
  }, [nodes])

  const hasIncompatible = useMemo(
    () => compatibility.some((c, i) => i > 0 && !c.compatible),
    [compatibility],
  )

  const totalDuration = useMemo(
    () => timelineSlots.reduce((s, sl) => s + (nodeMap[sl.nodeId]?.duration ?? 0), 0),
    [timelineSlots, nodeMap],
  )

  const downloadJson = () => {
    const payload = {
      timeline: timelineSlots.map((sl, i) => ({
        position: i + 1,
        node_id: sl.nodeId,
        name: nodeMap[sl.nodeId]?.name ?? sl.nodeId,
        duration: nodeMap[sl.nodeId]?.duration ?? 0,
        compatible_transition: compatibility[i]?.compatible !== false,
        score: compatibility[i]?.score ?? 1,
      })),
      total_duration: totalDuration,
      has_incompatible_transitions: hasIncompatible,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'linear-timeline.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-[95vw] max-h-[90vh] flex flex-col rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-text">Linear Timeline</h2>
            <span className="text-xs text-textMuted font-mono">{timelineSlots.length} slots · {totalDuration.toFixed(2)}s total</span>
            {hasIncompatible && (
              <span className="text-xs text-danger bg-danger/10 border border-danger/30 px-2 py-0.5 rounded-full">
                ⚠ Incompatible transitions
              </span>
            )}
            {!hasIncompatible && timelineSlots.length > 0 && (
              <span className="text-xs text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded-full">
                ✓ Seamless
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {timelineSlots.length > 0 && (
              <button
                onClick={downloadJson}
                className="
                  px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-surface border border-border text-text
                  hover:bg-surfaceHover transition-colors
                "
              >
                ↓ Download JSON
              </button>
            )}
            <button onClick={onClose} className="text-muted hover:text-text transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Timeline scroll area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          {timelineSlots.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-textMuted text-sm">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-40">▶</div>
                <p>Your timeline is empty.</p>
                <p className="text-xs mt-1 opacity-60">Click <strong>+TL</strong> on any node to add it here.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4" style={{ minWidth: 'max-content', paddingBottom: '2rem' }}>
              {timelineSlots.map((slot, idx) => {
                const nd = nodeMap[slot.nodeId]
                const compat = compatibility[idx]
                return (
                  <SlotCard
                    key={slot.slotId}
                    slot={slot}
                    position={idx}
                    name={nd?.name ?? slot.nodeId.slice(0, 8)}
                    firstFrameUrl={nd?.firstFrameUrl ?? ''}
                    lastFrameUrl={nd?.lastFrameUrl ?? ''}
                    duration={nd?.duration ?? 0}
                    compatScore={compat?.score ?? 1}
                    isFirst={idx === 0}
                    onMoveLeft={() => moveSlotLeft(slot.slotId)}
                    onMoveRight={() => moveSlotRight(slot.slotId)}
                    onDuplicate={() => duplicateInTimeline(slot.slotId)}
                    onRemove={() => removeFromTimeline(slot.slotId)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Footer: legend */}
        <div className="px-5 py-3 border-t border-border flex items-center gap-6 text-xs text-textMuted flex-shrink-0">
          <span>Threshold: <strong className="text-text">{(ssimThreshold * 100).toFixed(0)}%</strong></span>
          <span><span className="text-success">✓</span> = last frame of prev matches first frame of next</span>
          <span><span className="text-danger">✗</span> = incompatible transition (frames too different)</span>
          <span>⎘ = duplicate node in timeline (same clip, different slot)</span>
          <span className="ml-auto text-[10px] opacity-50">First slot is always allowed regardless of mismatch with last slot</span>
        </div>
      </div>
    </div>
  )
}
