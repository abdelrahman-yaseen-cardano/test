import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import type { TimelineEntry } from '../types'

// Colour palette for cycle groups
const CYCLE_COLORS = [
  ['#6366f1', '#818cf8'],
  ['#10b981', '#34d399'],
  ['#f59e0b', '#fbbf24'],
  ['#ef4444', '#f87171'],
  ['#8b5cf6', '#a78bfa'],
  ['#06b6d4', '#22d3ee'],
]

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(2)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

interface TimelineProps {
  entries: TimelineEntry[]
  totalDuration: number
}

export function Timeline({ entries, totalDuration }: TimelineProps) {
  if (!entries.length) {
    return (
      <div className="flex items-center justify-center h-24 text-textMuted text-sm">
        No timeline data yet — run an export first.
      </div>
    )
  }

  const scale = 100 / totalDuration // percent per second

  // Build tick marks every ~5s or proportional
  const tickInterval = totalDuration <= 30 ? 1
    : totalDuration <= 120 ? 5
    : totalDuration <= 600 ? 15
    : 60
  const ticks = useMemo(() => {
    const t: number[] = []
    for (let s = 0; s <= totalDuration; s += tickInterval) t.push(s)
    return t
  }, [totalDuration, tickInterval])

  return (
    <div className="flex flex-col gap-2">
      {/* Ruler */}
      <div className="relative h-5 ml-32">
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute flex flex-col items-center"
            style={{ left: `${t * scale}%` }}
          >
            <div className="w-px h-2 bg-border" />
            <span className="text-[10px] text-textMuted font-mono mt-0.5">{formatTime(t)}</span>
          </div>
        ))}
      </div>

      {/* Rows — one per cycle × repeat */}
      {(() => {
        // Group entries by cycle_index + repeat_index
        const rows = new Map<string, TimelineEntry[]>()
        for (const e of entries) {
          const key = `${e.cycle_index}-${e.repeat_index}`
          if (!rows.has(key)) rows.set(key, [])
          rows.get(key)!.push(e)
        }

        return Array.from(rows.entries()).map(([key, rowEntries]) => {
          const [ci, ri] = key.split('-').map(Number)
          const [bg, border] = CYCLE_COLORS[ci % CYCLE_COLORS.length]
          const rowStart = rowEntries[0].start
          const rowEnd = rowEntries[rowEntries.length - 1].end

          return (
            <div key={key} className="flex items-center gap-2">
              {/* Label */}
              <div className="flex-none w-28 text-right pr-2">
                <span className="text-xs text-textMuted font-mono">
                  C{ci + 1} ×{ri + 1}
                </span>
              </div>

              {/* Track */}
              <div className="relative flex-1 h-10 bg-surface rounded border border-border overflow-hidden">
                {rowEntries.map((e, i) => {
                  const left = ((e.start - rowStart) / (rowEnd - rowStart)) * 100
                  const width = ((e.end - e.start) / (rowEnd - rowStart)) * 100

                  return (
                    <div
                      key={`${e.node_id}-${i}`}
                      className="absolute top-0 h-full flex items-center justify-center text-[10px] font-medium truncate px-1 rounded-sm border-r border-black/30"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: bg,
                        borderColor: border,
                        color: '#fff',
                        minWidth: 2,
                      }}
                      title={`${e.name}\n${formatTime(e.start)} → ${formatTime(e.end)}`}
                    >
                      {width > 5 ? e.name : ''}
                    </div>
                  )
                })}
              </div>

              {/* Duration */}
              <div className="flex-none w-16 text-xs text-textMuted font-mono text-right">
                {formatTime(rowEnd - rowStart)}
              </div>
            </div>
          )
        })
      })()}

      {/* Total */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border mt-1">
        <span className="text-xs text-textMuted">Total duration:</span>
        <span className="text-sm font-mono text-text">{formatTime(totalDuration)}</span>
      </div>
    </div>
  )
}
