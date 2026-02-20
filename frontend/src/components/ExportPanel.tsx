import { useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { Timeline } from './Timeline'
import type { ExportCycle } from '../types'

// ──────────────────────────────────────────────
// Node picker row inside a cycle
// ──────────────────────────────────────────────

function CycleRow({
  cycle,
  index,
  allNodes,
  onChange,
  onRemove,
}: {
  cycle: ExportCycle
  index: number
  allNodes: { id: string; name: string }[]
  onChange: (c: ExportCycle) => void
  onRemove: () => void
}) {
  const addNode = (id: string) => {
    if (id && !cycle.nodeIds.includes(id)) {
      onChange({ ...cycle, nodeIds: [...cycle.nodeIds, id] })
    }
  }
  const removeNode = (idx: number) => {
    onChange({ ...cycle, nodeIds: cycle.nodeIds.filter((_, i) => i !== idx) })
  }
  const moveUp = (idx: number) => {
    if (idx === 0) return
    const arr = [...cycle.nodeIds]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    onChange({ ...cycle, nodeIds: arr })
  }
  const moveDown = (idx: number) => {
    if (idx === cycle.nodeIds.length - 1) return
    const arr = [...cycle.nodeIds]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    onChange({ ...cycle, nodeIds: arr })
  }

  const getName = (id: string) => allNodes.find((n) => n.id === id)?.name ?? id.slice(0, 8)

  return (
    <div className="border border-border rounded-xl p-3 bg-surface">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-primary uppercase tracking-wide">Cycle {index + 1}</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-textMuted">Repeat</label>
          <input
            type="number"
            min={1}
            max={999}
            value={cycle.repeat}
            onChange={(e) => onChange({ ...cycle, repeat: Math.max(1, parseInt(e.target.value) || 1) })}
            className="
              w-16 bg-bg border border-border rounded px-2 py-0.5
              text-xs text-text font-mono text-center
              focus:border-primary outline-none
            "
          />
          <span className="text-xs text-textMuted">× times</span>
          <button onClick={onRemove} className="text-muted hover:text-danger transition-colors text-sm ml-1">✕</button>
        </div>
      </div>

      {/* Sequence pills */}
      <div className="flex flex-wrap gap-1 mb-2 min-h-[28px]">
        {cycle.nodeIds.map((id, i) => (
          <span
            key={`${id}-${i}`}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-primary/10 border border-primary/30 text-text"
          >
            <button onClick={() => moveUp(i)} className="text-textMuted hover:text-text px-0.5">‹</button>
            {getName(id)}
            <button onClick={() => moveDown(i)} className="text-textMuted hover:text-text px-0.5">›</button>
            <button onClick={() => removeNode(i)} className="text-muted hover:text-danger ml-0.5">×</button>
          </span>
        ))}
        {cycle.nodeIds.length === 0 && (
          <span className="text-xs text-textMuted italic">No clips added</span>
        )}
      </div>

      {/* Add node dropdown */}
      <select
        onChange={(e) => { addNode(e.target.value); e.target.value = '' }}
        defaultValue=""
        className="
          w-full bg-bg border border-border rounded-lg px-2 py-1.5
          text-xs text-text focus:border-primary outline-none
        "
      >
        <option value="">+ Add a clip / group to this cycle…</option>
        {allNodes.map((n) => (
          <option key={n.id} value={n.id}>{n.name}</option>
        ))}
      </select>
    </div>
  )
}

// ──────────────────────────────────────────────
// Export Panel
// ──────────────────────────────────────────────

export function ExportPanel({ onClose }: { onClose: () => void }) {
  const nodes = useStore((s) => s.nodes)
  const exportCycles = useStore((s) => s.exportCycles)
  const setExportCycles = useStore((s) => s.setExportCycles)
  const runExport = useStore((s) => s.runExport)
  const exportResult = useStore((s) => s.exportResult)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'builder' | 'timeline' | 'json'>('builder')

  const allNodes = nodes.map((n) => ({ id: n.id, name: (n.data as any).name }))

  const addCycle = useCallback(() => {
    setExportCycles([...exportCycles, { nodeIds: [], repeat: 1 }])
  }, [exportCycles, setExportCycles])

  const updateCycle = useCallback(
    (i: number, c: ExportCycle) => {
      const next = [...exportCycles]
      next[i] = c
      setExportCycles(next)
    },
    [exportCycles, setExportCycles],
  )

  const removeCycle = useCallback(
    (i: number) => {
      setExportCycles(exportCycles.filter((_, idx) => idx !== i))
    },
    [exportCycles, setExportCycles],
  )

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    try {
      await runExport()
      setTab('timeline')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const downloadJson = () => {
    if (!exportResult) return
    const blob = new Blob([JSON.stringify(exportResult, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'loop-engine-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text">Export Sequence</h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          {(['builder', 'timeline', 'json'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`
                px-4 py-2.5 text-xs font-medium capitalize transition-colors
                ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-text'}
              `}
            >
              {t === 'builder' ? '⊕ Cycle Builder' : t === 'timeline' ? '▶ Timeline' : '{ } JSON'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'builder' && (
            <div className="flex flex-col gap-3">
              {exportCycles.length === 0 && (
                <p className="text-sm text-textMuted italic text-center py-4">
                  Add cycles below to build your playback sequence.
                </p>
              )}
              {exportCycles.map((c, i) => (
                <CycleRow
                  key={i}
                  cycle={c}
                  index={i}
                  allNodes={allNodes}
                  onChange={(nc) => updateCycle(i, nc)}
                  onRemove={() => removeCycle(i)}
                />
              ))}
              <button
                onClick={addCycle}
                className="
                  w-full py-2 rounded-xl border-2 border-dashed border-border
                  text-xs text-textMuted hover:text-text hover:border-primary/50
                  transition-colors
                "
              >
                + Add Cycle
              </button>
            </div>
          )}

          {tab === 'timeline' && (
            <div>
              {exportResult ? (
                <Timeline entries={exportResult.timeline} totalDuration={exportResult.total_duration} />
              ) : (
                <p className="text-sm text-textMuted italic text-center py-8">Run export to see timeline.</p>
              )}
            </div>
          )}

          {tab === 'json' && (
            <pre className="text-xs text-text font-mono bg-surface rounded-xl p-4 overflow-auto max-h-96 border border-border">
              {exportResult ? JSON.stringify(exportResult, null, 2) : 'No export data yet.'}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 ml-auto">
            {exportResult && (
              <button
                onClick={downloadJson}
                className="
                  px-4 py-2 rounded-lg text-xs font-medium
                  bg-surface border border-border text-text
                  hover:bg-surfaceHover transition-colors
                "
              >
                ↓ Download JSON
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={loading || exportCycles.length === 0}
              className="
                px-5 py-2 rounded-lg text-xs font-semibold
                bg-primary text-white hover:bg-primaryHover
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors flex items-center gap-2
              "
            >
              {loading ? (
                <><span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />Exporting…</>
              ) : '⊞ Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
