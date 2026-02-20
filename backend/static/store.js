// store.js — Zustand state management + React Flow state
import { create } from 'zustand'

const NODE_WIDTH = 440
const NODE_GAP   = 60
const START_X    = 80
const START_Y    = 160

function autoPos(totalCount, index) {
  const cols = Math.min(4, Math.ceil(Math.sqrt(Math.max(totalCount, 1))))
  return {
    x: START_X + (index % cols) * (NODE_WIDTH + NODE_GAP),
    y: START_Y + Math.floor(index / cols) * 270,
  }
}

export function makeFlowNode(data, pos) {
  return {
    id: data.id,
    type: data.type === 'group' ? 'groupNode' : 'videoNode',
    position: pos,
    data,
    selected: false,
  }
}

// Minimal react-flow helpers (no npm needed — pure state)
function applyNodeChange(changes, nodes) {
  let next = [...nodes]
  for (const ch of changes) {
    if (ch.type === 'position' && ch.position) {
      next = next.map(n => n.id === ch.id ? { ...n, position: ch.position } : n)
    } else if (ch.type === 'select') {
      next = next.map(n => n.id === ch.id ? { ...n, selected: ch.selected } : n)
    } else if (ch.type === 'remove') {
      next = next.filter(n => n.id !== ch.id)
    } else if (ch.type === 'dimensions' && ch.dimensions) {
      next = next.map(n => n.id === ch.id ? { ...n, measured: ch.dimensions } : n)
    }
  }
  return next
}

function applyEdgeChange(changes, edges) {
  let next = [...edges]
  for (const ch of changes) {
    if (ch.type === 'select') {
      next = next.map(e => e.id === ch.id ? { ...e, selected: ch.selected } : e)
    } else if (ch.type === 'remove') {
      next = next.filter(e => e.id !== ch.id)
    }
  }
  return next
}

export const useStore = create((set, get) => ({
  // ── ReactFlow state ───────────────────────
  nodes: [],
  edges: [],
  onNodesChange: changes => set(s => ({ nodes: applyNodeChange(changes, s.nodes) })),
  onEdgesChange: changes => set(s => ({ edges: applyEdgeChange(changes, s.edges) })),
  onConnect: conn => {
    const { edges } = get()
    const id = `e-${conn.source}-${conn.sourceHandle}-${conn.target}-${conn.targetHandle}`
    if (!edges.find(e => e.id === id)) {
      set({ edges: [...edges, { ...conn, id, animated: true, type: 'loopEdge' }] })
    }
    get().clearActiveKnob()
  },

  // ── Knob / compatibility ───────────────────
  activeKnob: null,          // { nodeId, side }
  compatibleHandles: [],     // [{ nodeId, side, score }]
  ssimThreshold: 0.75,
  setThreshold: t => set({ ssimThreshold: t }),
  setSsimThreshold: t => set({ ssimThreshold: t }),
  triggerKnob: null,         // set to function after api import
  clearActiveKnob: () => set({ activeKnob: null, compatibleHandles: [] }),

  // ── UI ────────────────────────────────────
  selectedNodeIds: [],
  previewFrame: null,        // { url, label }
  showExport: false,

  // ── Export ────────────────────────────────
  exportCycles: [],
  exportResult: null,

  // ── Methods (set dynamically after api import) ──
  loadInitialData: null,
  uploadVideosFn: null,
  deleteNodeFn: null,
  renameNodeFn: null,
  groupSelectedFn: null,
  ungroupNodeFn: null,
  runExportFn: null,

  setExportCycles: c => set({ exportCycles: c }),
  setShowExport: v => set({ showExport: v }),
  openFramePreview: (url, label) => set({ previewFrame: { url, label } }),
  closeFramePreview: () => set({ previewFrame: null }),
}))
