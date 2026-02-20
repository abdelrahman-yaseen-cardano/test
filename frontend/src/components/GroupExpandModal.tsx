/**
 * GroupExpandModal
 *
 * Shown when the user double-clicks a GroupNode on the canvas.
 * Displays each child video node in a grid with its frames and metadata.
 */

import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import type { GroupNodeData, VideoFlowNodeData } from '../types'

export function GroupExpandModal() {
  const expandedGroupId = useStore((s) => s.expandedGroupId)
  const setExpandedGroupId = useStore((s) => s.setExpandedGroupId)
  const nodes = useStore((s) => s.nodes)

  const groupNode = useMemo(
    () => nodes.find((n) => n.id === expandedGroupId),
    [nodes, expandedGroupId],
  )
  const group = groupNode?.data as GroupNodeData | undefined

  const childNodes = useMemo(() => {
    if (!group?.childIds) return []
    return group.childIds
      .map((nid) => nodes.find((n) => n.id === nid))
      .filter(Boolean)
  }, [group, nodes])

  if (!expandedGroupId || !group) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={() => setExpandedGroupId(null)}
    >
      <div
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h2 className="text-base font-semibold text-text">{group.name}</h2>
            <span className="text-xs text-textMuted font-mono">{childNodes.length} clips</span>
          </div>
          <button
            onClick={() => setExpandedGroupId(null)}
            className="text-textMuted hover:text-text transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {childNodes.length === 0 ? (
            <p className="text-textMuted text-sm text-center py-16">This group has no child nodes.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {childNodes.map((node) => {
                if (!node) return null
                const d = node.data as VideoFlowNodeData
                return (
                  <div key={node.id} className="flex flex-col rounded-xl border border-border bg-surface overflow-hidden">
                    {/* Frames row */}
                    <div className="flex gap-1 p-2 bg-surfaceHover">
                      {d.firstFrameUrl && (
                        <img
                          src={d.firstFrameUrl}
                          className="flex-1 h-20 object-cover rounded border border-border/50"
                          alt="first frame"
                          title="First frame"
                        />
                      )}
                      {d.lastFrameUrl && (
                        <img
                          src={d.lastFrameUrl}
                          className="flex-1 h-20 object-cover rounded border border-border/50"
                          alt="last frame"
                          title="Last frame"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2">
                      <div className="text-xs font-semibold text-text truncate" title={d.name}>{d.name}</div>
                      {d.originalFilename && d.originalFilename !== d.name && (
                        <div className="text-[10px] text-textMuted truncate" title={d.originalFilename}>
                          {d.originalFilename}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-textMuted font-mono">{d.duration?.toFixed(2) ?? '–'}s</span>
                        <span className="text-[10px] text-textMuted font-mono">
                          {d.width}×{d.height}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex-shrink-0 text-xs text-textMuted">
          Click outside or press Esc to close
        </div>
      </div>
    </div>
  )
}
