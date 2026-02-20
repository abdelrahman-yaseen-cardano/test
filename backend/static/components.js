/**
 * components.js – All React UI components, no JSX/transpile.
 * Uses React.createElement (aliased as ce) and htm for tagged template literals.
 *
 * Import map (in index.html) resolves bare specifiers:
 *   react, react-dom, @xyflow/react, zustand, htm, clsx
 */

import * as React from 'react'
import htm from 'htm'
import {
  ReactFlow, Background, Controls, MiniMap,
  Handle, Position, BaseEdge, getBezierPath, MarkerType,
} from '@xyflow/react'
import { useStore } from './store.js'

// Bind htm once – all components use this html tag
const html = htm.bind(React.createElement)

// ─── tiny class-name helper ──────────────────────────────────────────
function cx(...args) {
  return args.flatMap(a => {
    if (!a) return []
    if (typeof a === 'string') return [a]
    if (typeof a === 'object') return Object.entries(a).filter(([, v]) => v).map(([k]) => k)
    return []
  }).join(' ')
}

// ═══════════════════════════════════════════════════════════════
// KnobHandle  – coloured target/source handle per SSIM state
// ═══════════════════════════════════════════════════════════════
export function KnobHandle({ nodeId, side, nodeType = 'video' }) {
  const activeKnob       = useStore(s => s.activeKnob)
  const compatibleHandles = useStore(s => s.compatibleHandles)
  const triggerKnob      = useStore(s => s.triggerKnob)

  const pos   = side === 'left' ? Position.Left  : Position.Right
  const htype = side === 'left' ? 'target'        : 'source'

  let state = 'normal'
  if (activeKnob) {
    if (activeKnob.nodeId === nodeId && activeKnob.side === side) state = 'active'
    else if (compatibleHandles.some(h => h.nodeId === nodeId && h.side === side)) state = 'compatible'
    else state = 'dimmed'
  }

  const cls = cx(
    'rf-handle',
    state === 'normal'     && (nodeType === 'group' ? 'handle-warn'       : 'handle-normal'),
    state === 'active'     && 'handle-active',
    state === 'compatible' && 'handle-compatible',
    state === 'dimmed'     && 'handle-dimmed',
  )

  const onMouseDown = React.useCallback(e => {
    const { clientX: sx, clientY: sy } = e
    const up = ue => {
      if (Math.abs(ue.clientX - sx) < 5 && Math.abs(ue.clientY - sy) < 5)
        triggerKnob?.(nodeId, side)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mouseup', up)
  }, [nodeId, side, triggerKnob])

  return html`<${Handle} type=${htype} position=${pos} id=${side} className=${cls} onMouseDown=${onMouseDown} />`
}

// ═══════════════════════════════════════════════════════════════
// FramePanel  – static first / last frame thumbnail
// ═══════════════════════════════════════════════════════════════
function FramePanel({ url, label, onPreview }) {
  return html`
    <button class="frame-panel" onClick=${onPreview} title=${'Preview ' + label}>
      <img src=${url} alt=${label} draggable="false" />
      <div class="frame-panel__label">${label}</div>
    </button>`
}

// ═══════════════════════════════════════════════════════════════
// VideoPanel  – click-to-play inline preview
// ═══════════════════════════════════════════════════════════════
function VideoPanel({ url }) {
  const ref     = React.useRef(null)
  const [playing, setPlaying] = React.useState(false)

  const toggle = e => {
    e.stopPropagation()
    const v = ref.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else          { v.play();  setPlaying(true)  }
  }

  return html`
    <div class="video-panel" onClick=${toggle}>
      <video ref=${ref} src=${url} loop muted preload="metadata"
             onEnded=${() => setPlaying(false)} />
      <div class=${cx('video-panel__play', playing && 'hidden')}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </div>
    </div>`
}

// ═══════════════════════════════════════════════════════════════
// VideoNode   (ReactFlow custom node type "videoNode")
// ═══════════════════════════════════════════════════════════════
export const VideoNodeComponent = React.memo(function VideoNode({ data, id, selected }) {
  const [editing, setEditing] = React.useState(false)
  const [draft,   setDraft  ] = React.useState(data.name)
  const openPreview  = useStore(s => s.openFramePreview)
  const renameNodeFn = useStore(s => s.renameNodeFn)
  const deleteNodeFn = useStore(s => s.deleteNodeFn)

  const commit = () => {
    const t = draft.trim()
    if (t && t !== data.name) renameNodeFn?.(id, t)
    setEditing(false)
  }

  return html`
    <div class=${cx('vnode', selected && 'selected')}>
      <div class="vnode__header">
        ${editing
          ? html`<input class="vnode__name-input" autoFocus value=${draft}
                   onChange=${e => setDraft(e.target.value)}
                   onBlur=${commit}
                   onKeyDown=${e => e.key === 'Enter' && commit()} />`
          : html`<span class="vnode__name" onDblClick=${() => { setDraft(data.name); setEditing(true) }}
                       title="Double-click to rename">${data.name}</span>`}
        <div class="vnode__meta">
          <span class="vnode__dur">${data.duration?.toFixed(2)}s</span>
          <span class="vnode__dim">${data.width}×${data.height}</span>
          <button class="vnode__del" onClick=${() => deleteNodeFn?.(id)} title="Delete">✕</button>
        </div>
      </div>

      <div class="vnode__body">
        <${FramePanel} url=${data.firstFrameUrl} label="First Frame"
          onPreview=${() => openPreview?.(data.firstFrameUrl, data.name + ' — First Frame')} />
        <${VideoPanel} url=${data.videoUrl} />
        <${FramePanel} url=${data.lastFrameUrl} label="Last Frame"
          onPreview=${() => openPreview?.(data.lastFrameUrl, data.name + ' — Last Frame')} />
      </div>

      <${KnobHandle} nodeId=${id} side="left"  />
      <${KnobHandle} nodeId=${id} side="right" />
    </div>`
})

// ═══════════════════════════════════════════════════════════════
// GroupNode   (ReactFlow custom node type "groupNode")
// ═══════════════════════════════════════════════════════════════
export const GroupNodeComponent = React.memo(function GroupNode({ data, id, selected }) {
  const [editing, setEditing] = React.useState(false)
  const [draft,   setDraft  ] = React.useState(data.name)
  const openPreview  = useStore(s => s.openFramePreview)
  const renameNodeFn = useStore(s => s.renameNodeFn)
  const deleteNodeFn = useStore(s => s.deleteNodeFn)
  const ungroupNodeFn = useStore(s => s.ungroupNodeFn)

  const commit = () => {
    const t = draft.trim()
    if (t && t !== data.name) renameNodeFn?.(id, t)
    setEditing(false)
  }

  return html`
    <div class=${cx('gnode', selected && 'selected')}>
      <div class="gnode__header">
        <div class="gnode__name-wrap">
          <span class="gnode__tag">Group</span>
          ${editing
            ? html`<input class="gnode__name-input" autoFocus value=${draft}
                     onChange=${e => setDraft(e.target.value)}
                     onBlur=${commit}
                     onKeyDown=${e => e.key === 'Enter' && commit()} />`
            : html`<span class="gnode__name" onDblClick=${() => { setDraft(data.name); setEditing(true) }}>
                     ${data.name}</span>`}
        </div>
        <div class="gnode__controls">
          <span class="gnode__clips">
            ${data.childIds?.length ?? 0} clips · ${data.duration?.toFixed(2) ?? '0.00'}s
          </span>
          <button class="gnode__ungroup" onClick=${() => ungroupNodeFn?.(id)} title="Ungroup">⊞</button>
          <button class="vnode__del"     onClick=${() => deleteNodeFn?.(id)}  title="Delete">✕</button>
        </div>
      </div>

      <div class="gnode__body">
        <${FramePanel} url=${data.firstFrameUrl} label="First Frame"
          onPreview=${() => openPreview?.(data.firstFrameUrl, data.name + ' — First Frame')} />
        <div class="gnode__middle">
          <div class="gnode__icon">⊻</div>
          <div class="gnode__info">
            ${data.childIds?.length ?? 0} segments${'\n'}${data.duration?.toFixed(2) ?? '0.00'}s total
          </div>
        </div>
        <${FramePanel} url=${data.lastFrameUrl} label="Last Frame"
          onPreview=${() => openPreview?.(data.lastFrameUrl, data.name + ' — Last Frame')} />
      </div>

      <${KnobHandle} nodeId=${id} side="left"  nodeType="group" />
      <${KnobHandle} nodeId=${id} side="right" nodeType="group" />
    </div>`
})

// ═══════════════════════════════════════════════════════════════
// LoopEdge  – gradient animated edge
// ═══════════════════════════════════════════════════════════════
export function LoopEdge({ id, sourceX, sourceY, targetX, targetY,
                           sourcePosition, targetPosition, selected }) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  return html`
    <g>
      <defs>
        <linearGradient id=${'grad-' + id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="#6366f1" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
      </defs>
      <${BaseEdge} path=${edgePath} style=${{
        stroke:      selected ? '#10b981' : 'url(#grad-' + id + ')',
        strokeWidth: selected ? 3 : 2,
        filter:      selected ? 'drop-shadow(0 0 4px #10b981)' : undefined,
      }} />
    </g>`
}

// ═══════════════════════════════════════════════════════════════
// UploadZone
// ═══════════════════════════════════════════════════════════════
export function UploadZone() {
  const uploadVideosFn = useStore(s => s.uploadVideosFn)
  const [dragging,  setDragging ] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [error,     setError    ] = React.useState(null)
  const inputRef = React.useRef(null)

  const handle = React.useCallback(async files => {
    const vids = [...files].filter(f => f.type.startsWith('video/'))
    if (!vids.length) { setError('No video files found.'); return }
    setUploading(true); setError(null)
    try { await uploadVideosFn(vids) }
    catch (e) { setError(e?.message ?? 'Upload failed') }
    finally { setUploading(false) }
  }, [uploadVideosFn])

  return html`
    <div class=${cx('upload-zone', dragging && 'drag-over')}
         onDragOver=${e => { e.preventDefault(); setDragging(true) }}
         onDragLeave=${() => setDragging(false)}
         onDrop=${e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
         onClick=${() => inputRef.current?.click()}>

      ${!uploading && html`
        <input ref=${inputRef} type="file" multiple accept="video/*" style="display:none"
               onChange=${e => e.target.files && handle(e.target.files)} />`}

      ${uploading
        ? html`
          <div class="upload-zone__spinner"></div>
          <p class="upload-zone__hint">Uploading &amp; extracting frames…</p>`
        : html`
          <div class="upload-zone__icon">⬆</div>
          <p class="upload-zone__text">Drop videos or click</p>
          <p class="upload-zone__hint">Bulk · MP4 MOV WebM…</p>`}

      ${error && html`<p class="upload-zone__error">${error}</p>`}
    </div>`
}

// ═══════════════════════════════════════════════════════════════
// FramePreviewModal
// ═══════════════════════════════════════════════════════════════
export function FramePreviewModal() {
  const frame = useStore(s => s.previewFrame)
  const close = useStore(s => s.closeFramePreview)
  if (!frame) return null

  return html`
    <div class="modal-backdrop" onClick=${close}>
      <div class="modal-box" onClick=${e => e.stopPropagation()}>
        <div class="modal-header">
          <span>${frame.label}</span>
          <button class="modal-close" onClick=${close}>×</button>
        </div>
        <img class="modal-img" src=${frame.url} alt=${frame.label} />
      </div>
    </div>`
}

// ═══════════════════════════════════════════════════════════════
// Timeline
// ═══════════════════════════════════════════════════════════════
const CYCLE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

function fmtTime(sec) {
  if (!sec && sec !== 0) return '—'
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(2)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function Timeline({ entries, totalDuration }) {
  if (!entries?.length)
    return html`<div class="tl-empty">No timeline data yet — run export first.</div>`

  const scale = 100 / (totalDuration || 1)
  const tickInterval = totalDuration <= 30 ? 1 : totalDuration <= 120 ? 5 : 15
  const ticks = []
  for (let s = 0; s <= totalDuration; s += tickInterval) ticks.push(s)

  // Group entries by cycle_index + repeat_index
  const rowMap = new Map()
  for (const e of entries) {
    const key = `${e.cycle_index}-${e.repeat_index}`
    if (!rowMap.has(key)) rowMap.set(key, [])
    rowMap.get(key).push(e)
  }

  return html`
    <div class="tl-wrap">
      <!-- ruler -->
      <div class="tl-ruler">
        ${ticks.map(t => html`
          <div key=${t} class="tl-tick" style=${{ position: 'absolute', left: (t * scale) + '%' }}>
            <div class="tl-tick-bar"></div>
            <div class="tl-tick-label">${fmtTime(t)}</div>
          </div>`)}
      </div>

      <!-- rows -->
      ${[...rowMap.entries()].map(([key, rowEntries]) => {
        const [ci] = key.split('-').map(Number)
        const bg = CYCLE_COLORS[ci % CYCLE_COLORS.length]
        const rowStart = rowEntries[0].start
        const rowEnd   = rowEntries[rowEntries.length - 1].end
        const span     = (rowEnd - rowStart) || 1

        return html`
          <div key=${key} class="tl-row">
            <div class="tl-row-label">C${ci + 1} ×${key.split('-')[1]}</div>
            <div class="tl-track">
              ${rowEntries.map((e, i) => html`
                <div key=${e.node_id + '-' + i} class="tl-segment"
                     title=${e.name + '\n' + fmtTime(e.start) + ' → ' + fmtTime(e.end)}
                     style=${{
                       left:       ((e.start - rowStart) / span * 100) + '%',
                       width:      ((e.end - e.start) / span * 100) + '%',
                       background: bg,
                       minWidth:   '2px',
                     }}>
                  ${((e.end - e.start) / span * 100 > 8) ? e.name : ''}
                </div>`)}
            </div>
            <div class="tl-row-dur">${fmtTime(rowEnd - rowStart)}</div>
          </div>`
      })}

      <div class="tl-total">
        <span class="tl-total-label">Total:</span>
        <span class="tl-total-val">${fmtTime(totalDuration)}</span>
      </div>
    </div>`
}

// ═══════════════════════════════════════════════════════════════
// CycleCard  – one cycle row inside ExportPanel
// ═══════════════════════════════════════════════════════════════
function CycleCard({ cycle, index, allNodes, onChange, onRemove }) {
  const getName = id => allNodes.find(n => n.id === id)?.name ?? id.slice(0, 8)

  const addNode = id => {
    if (id && !cycle.nodeIds.includes(id))
      onChange({ ...cycle, nodeIds: [...cycle.nodeIds, id] })
  }
  const removeNode = i => onChange({ ...cycle, nodeIds: cycle.nodeIds.filter((_, j) => j !== i) })
  const swap = (i, j) => {
    const arr = [...cycle.nodeIds];[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange({ ...cycle, nodeIds: arr })
  }

  return html`
    <div class="cycle-card">
      <div class="cycle-card__header">
        <span class="cycle-card__title">Cycle ${index + 1}</span>
        <div class="cycle-card__controls">
          <span class="repeat-label">Repeat</span>
          <input type="number" class="repeat-input" min="1" max="999" value=${cycle.repeat}
                 onChange=${e => onChange({ ...cycle, repeat: Math.max(1, parseInt(e.target.value) || 1) })} />
          <span class="repeat-label">×</span>
          <button class="vnode__del" onClick=${onRemove}>✕</button>
        </div>
      </div>

      <div class="cycle-card__pills">
        ${cycle.nodeIds.length === 0
          ? html`<span class="cycle-card__empty">No clips added yet</span>`
          : cycle.nodeIds.map((id, i) => html`
              <span key=${id + '-' + i} class="pill">
                <button onClick=${() => swap(i, i - 1)} disabled=${i === 0}>‹</button>
                ${getName(id)}
                <button onClick=${() => swap(i, i + 1)} disabled=${i === cycle.nodeIds.length - 1}>›</button>
                <button onClick=${() => removeNode(i)}>×</button>
              </span>`)}
      </div>

      <select class="node-select" onChange=${e => { addNode(e.target.value); e.target.value = '' }}
              value="">
        <option value="">+ Add a clip / group to this cycle…</option>
        ${allNodes.map(n => html`<option key=${n.id} value=${n.id}>${n.name}</option>`)}
      </select>
    </div>`
}

// ═══════════════════════════════════════════════════════════════
// ExportPanel  – modal with Cycle Builder | Timeline | JSON tabs
// ═══════════════════════════════════════════════════════════════
export function ExportPanel({ onClose }) {
  const nodes        = useStore(s => s.nodes)
  const cycles       = useStore(s => s.exportCycles)
  const setCycles    = useStore(s => s.setExportCycles)
  const runExportFn  = useStore(s => s.runExportFn)
  const exportResult = useStore(s => s.exportResult)

  const [loading, setLoading] = React.useState(false)
  const [error,   setError  ] = React.useState(null)
  const [tab,     setTab    ] = React.useState('builder')

  const allNodes = nodes.map(n => ({ id: n.id, name: n.data?.name ?? n.id.slice(0, 8) }))

  const addCycle    = () => setCycles([...cycles, { nodeIds: [], repeat: 1 }])
  const updateCycle = (i, c) => { const next = [...cycles]; next[i] = c; setCycles(next) }
  const removeCycle = i => setCycles(cycles.filter((_, j) => j !== i))

  const doExport = async () => {
    setLoading(true); setError(null)
    try { await runExportFn?.(); setTab('timeline') }
    catch (e) { setError(e?.message ?? 'Export failed') }
    finally { setLoading(false) }
  }

  const download = () => {
    if (!exportResult) return
    const blob = new Blob([JSON.stringify(exportResult, null, 2)], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: 'loop-engine-export.json',
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  return html`
    <div class="epanel-backdrop" onClick=${onClose}>
      <div class="epanel" onClick=${e => e.stopPropagation()}>

        <div class="epanel__header">
          <h2>Export Sequence</h2>
          <button class="modal-close" onClick=${onClose}>×</button>
        </div>

        <div class="epanel__tabs">
          <button class=${cx('epanel__tab', tab === 'builder'  && 'active')} onClick=${() => setTab('builder')}>
            ⊕ Cycle Builder
          </button>
          <button class=${cx('epanel__tab', tab === 'timeline' && 'active')} onClick=${() => setTab('timeline')}>
            ▶ Timeline
          </button>
          <button class=${cx('epanel__tab', tab === 'json'     && 'active')} onClick=${() => setTab('json')}>
            {} JSON
          </button>
        </div>

        <div class="epanel__body">
          ${tab === 'builder' && html`
            <div>
              ${cycles.length === 0 && html`
                <p class="epanel-hint">Add cycles to build your export sequence.</p>`}
              ${cycles.map((c, i) => html`
                <${CycleCard} key=${i} cycle=${c} index=${i} allNodes=${allNodes}
                  onChange=${nc => updateCycle(i, nc)}
                  onRemove=${() => removeCycle(i)} />`)}
              <button class="add-cycle-btn" onClick=${addCycle}>+ Add Cycle</button>
            </div>`}

          ${tab === 'timeline' && html`
            <div>
              ${exportResult
                ? html`<${Timeline} entries=${exportResult.timeline}
                          totalDuration=${exportResult.total_duration} />`
                : html`<p class="epanel-hint">Run export to see timeline.</p>`}
            </div>`}

          ${tab === 'json' && html`
            <pre class="json-view">${
              exportResult ? JSON.stringify(exportResult, null, 2) : 'No export yet.'
            }</pre>`}
        </div>

        <div class="epanel__footer">
          ${error && html`<span class="epanel__error">${error}</span>`}
          ${exportResult && html`
            <button class="btn btn-ghost btn-sm" onClick=${download}>↓ Download JSON</button>`}
          <button class="btn btn-primary btn-sm"
                  disabled=${loading || cycles.length === 0}
                  onClick=${doExport}>
            ${loading ? '…Exporting' : '⊞ Run Export'}
          </button>
        </div>

      </div>
    </div>`
}

// ═══════════════════════════════════════════════════════════════
// NodeEditor  – ReactFlow canvas
// ═══════════════════════════════════════════════════════════════
export function NodeEditor() {
  const nodes           = useStore(s => s.nodes)
  const edges           = useStore(s => s.edges)
  const onNodesChange   = useStore(s => s.onNodesChange)
  const onEdgesChange   = useStore(s => s.onEdgesChange)
  const onConnect       = useStore(s => s.onConnect)
  const clearActiveKnob = useStore(s => s.clearActiveKnob)
  const activeKnob      = useStore(s => s.activeKnob)
  const groupSelectedFn = useStore(s => s.groupSelectedFn)
  const loadInitialData = useStore(s => s.loadInitialData)

  const selectedCount = nodes.filter(n => n.selected).length

  React.useEffect(() => { loadInitialData?.() }, [])  // eslint-disable-line

  const nodeTypes = React.useMemo(() => ({
    videoNode: VideoNodeComponent,
    groupNode: GroupNodeComponent,
  }), [])

  const edgeTypes = React.useMemo(() => ({ loopEdge: LoopEdge }), [])

  const defaultEdgeOptions = React.useMemo(() => ({
    type: 'loopEdge',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  }), [])

  return html`
    <div class="canvas-wrap">

      <!-- floating toolbar -->
      <div class="canvas-toolbar">
        ${selectedCount >= 2 && html`
          <button class="btn btn-warning-outline btn-sm" onClick=${groupSelectedFn}>
            ⊞ Group ${selectedCount} selected
          </button>`}
        ${activeKnob && html`
          <div class="connecting-banner">
            <span class="dot"></span>
            Connecting from <strong>${activeKnob.side}</strong> knob…
            <button class="close-x" onClick=${clearActiveKnob}>✕</button>
          </div>`}
      </div>

      <${ReactFlow}
        nodes=${nodes}
        edges=${edges}
        onNodesChange=${onNodesChange}
        onEdgesChange=${onEdgesChange}
        onConnect=${onConnect}
        onPaneClick=${() => activeKnob && clearActiveKnob?.()}
        nodeTypes=${nodeTypes}
        edgeTypes=${edgeTypes}
        defaultEdgeOptions=${defaultEdgeOptions}
        fitView=${true}
        fitViewOptions=${{ padding: 0.2 }}
        minZoom=${0.1}
        maxZoom=${2}
        deleteKeyCode=${['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        panOnScroll=${true}
        selectionOnDrag=${true}
        panOnDrag=${[1, 2]}
        proOptions=${{ hideAttribution: true }}
      >
        <${Background} variant="dots" gap=${24} size=${1} color="#2e2e3e" />
        <${Controls} />
        <${MiniMap}
          nodeColor=${n => n.data?.type === 'group' ? '#f59e0b' : '#6366f1'}
          maskColor="rgba(15,15,19,0.7)"
        />
      <//>
    </div>`
}
