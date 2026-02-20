import { create } from 'zustand'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import type { NodeData, VideoNodeData, GroupNodeData, SimilarityResult, ActiveKnob, ExportCycle, ExportResponse } from '../types'
import * as api from '../api/client'

// ──────────────────────────────────────────────
// Store shape
// ──────────────────────────────────────────────

interface LoopEngineState {
  // Flow state
  nodes: Node<NodeData>[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect

  // Compatibility
  activeKnob: ActiveKnob | null
  compatibleHandles: SimilarityResult[]
  ssimThreshold: number
  setThreshold: (t: number) => void

  // UI
  selectedNodeIds: string[]
  previewFrame: { url: string; label: string } | null
  showTimeline: boolean
  showExport: boolean

  // Actions
  loadInitialData: () => Promise<void>
  uploadVideos: (files: FileList | File[]) => Promise<void>
  renameNode: (id: string, name: string) => void
  deleteNode: (id: string) => void
  groupSelected: () => Promise<void>
  ungroupNode: (groupId: string) => void
  triggerKnob: (nodeId: string, side: 'left' | 'right') => Promise<void>
  clearActiveKnob: () => void
  openFramePreview: (url: string, label: string) => void
  closeFramePreview: () => void
  setShowTimeline: (v: boolean) => void
  setShowExport: (v: boolean) => void

  // Export
  exportCycles: ExportCycle[]
  exportResult: ExportResponse | null
  setExportCycles: (c: ExportCycle[]) => void
  runExport: () => Promise<void>
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const NODE_WIDTH = 440
const NODE_START_X = 80
const NODE_START_Y = 160
const NODE_GAP = 60

function makeFlowNode(data: VideoNodeData | GroupNodeData, position: { x: number; y: number }): Node<NodeData> {
  return {
    id: data.id,
    type: data.type === 'group' ? 'groupNode' : 'videoNode',
    position,
    data,
    selected: false,
  }
}

function autoLayout(count: number, index: number): { x: number; y: number } {
  const cols = Math.min(4, Math.ceil(Math.sqrt(count)))
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    x: NODE_START_X + col * (NODE_WIDTH + NODE_GAP),
    y: NODE_START_Y + row * 260,
  }
}

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useStore = create<LoopEngineState>((set, get) => ({
  nodes: [],
  edges: [],
  activeKnob: null,
  compatibleHandles: [],
  ssimThreshold: 0.75,
  selectedNodeIds: [],
  previewFrame: null,
  showTimeline: false,
  showExport: false,
  exportCycles: [],
  exportResult: null,

  // ── Flow change handlers ──────────────────

  onNodesChange: (changes: NodeChange[]) => {
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
    // track selection
    const selected = get().nodes
      .filter((n) => n.selected)
      .map((n) => n.id)
    set({ selectedNodeIds: selected })
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }))
  },

  onConnect: (connection: Connection) => {
    set((s) => ({ edges: addEdge({ ...connection, animated: true }, s.edges) }))
    get().clearActiveKnob()
  },

  // ── Data loading ──────────────────────────

  loadInitialData: async () => {
    const [videos, groups] = await Promise.all([api.listVideos(), api.listGroups()])
    const all: NodeData[] = [...videos, ...groups]
    const nodes: Node<NodeData>[] = all.map((d, i) =>
      makeFlowNode(d, autoLayout(all.length, i)),
    )
    set({ nodes })
  },

  // ── Upload ────────────────────────────────

  uploadVideos: async (files) => {
    const newNodes = await api.uploadVideos(files)
    set((s) => {
      const existingCount = s.nodes.length
      const flowNodes = newNodes.map((d, i) =>
        makeFlowNode(d, autoLayout(existingCount + newNodes.length, existingCount + i)),
      )
      return { nodes: [...s.nodes, ...flowNodes] }
    })
  },

  // ── Rename ────────────────────────────────

  renameNode: (id, name) => {
    api.renameNode(id, name).catch(console.error)
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, name } } : n,
      ),
    }))
  },

  // ── Delete ────────────────────────────────

  deleteNode: (id) => {
    api.deleteNode(id).catch(console.error)
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    }))
  },

  // ── Group ─────────────────────────────────

  groupSelected: async () => {
    const { nodes, edges } = get()
    const selected = nodes.filter((n) => n.selected)
    if (selected.length < 2) return

    // Find ordered sequence via topological sort within selection
    const selSet = new Set(selected.map((n) => n.id))
    const intraEdges = edges.filter(
      (e) => selSet.has(e.source) && selSet.has(e.target),
    )

    // Build adjacency & in-degree
    const adj: Record<string, string[]> = {}
    const inDeg: Record<string, number> = {}
    for (const n of selected) {
      adj[n.id] = []
      inDeg[n.id] = 0
    }
    for (const e of intraEdges) {
      adj[e.source].push(e.target)
      inDeg[e.target] = (inDeg[e.target] ?? 0) + 1
    }
    const queue = selected.filter((n) => inDeg[n.id] === 0).map((n) => n.id)
    const ordered: string[] = []
    while (queue.length) {
      const cur = queue.shift()!
      ordered.push(cur)
      for (const next of adj[cur] ?? []) {
        inDeg[next]--
        if (inDeg[next] === 0) queue.push(next)
      }
    }
    if (ordered.length !== selected.length) {
      // Fallback: just use selection order
      ordered.splice(0, ordered.length, ...selected.map((n) => n.id))
    }

    // Collect frame URLs from first/last in order
    const firstNode = nodes.find((n) => n.id === ordered[0])?.data as VideoNodeData | GroupNodeData | undefined
    const lastNode = nodes.find((n) => n.id === ordered[ordered.length - 1])?.data as VideoNodeData | GroupNodeData | undefined
    const firstFrameUrl = firstNode?.firstFrameUrl ?? ''
    const lastFrameUrl = lastNode?.lastFrameUrl ?? ''
    const totalDuration = ordered.reduce((sum, id) => {
      const nd = nodes.find((n) => n.id === id)?.data as any
      return sum + (nd?.duration ?? 0)
    }, 0)

    const groupName = `Group (${ordered.length})`
    const group = await api.createGroup({
      name: groupName,
      childIds: ordered,
      firstFrameUrl,
      lastFrameUrl,
      duration: totalDuration,
    })

    // Calculate centroid position
    const cx =
      selected.reduce((s, n) => s + n.position.x, 0) / selected.length
    const cy =
      selected.reduce((s, n) => s + n.position.y, 0) / selected.length

    set((s) => ({
      nodes: [
        ...s.nodes.filter((n) => !selSet.has(n.id)),
        makeFlowNode(group, { x: cx, y: cy }),
      ],
      edges: s.edges.filter(
        (e) => !selSet.has(e.source) || !selSet.has(e.target),
      ),
    }))
  },

  ungroupNode: (groupId) => {
    const { nodes } = get()
    const groupNode = nodes.find((n) => n.id === groupId)
    if (!groupNode || groupNode.data.type !== 'group') return
    const groupData = groupNode.data as GroupNodeData

    // Note: child nodes were removed from flow when grouped. The API still has them.
    // We re-fetch them from the backend by reloading.
    api.deleteGroup(groupId).catch(console.error)
    api.listVideos().then((videos) => {
      set((s) => {
        const existingIds = new Set(s.nodes.map((n) => n.id))
        const toAdd = videos.filter((v) => groupData.childIds.includes(v.id) && !existingIds.has(v.id))
        const newNodes = toAdd.map((d, i) =>
          makeFlowNode(d, {
            x: groupNode.position.x + i * (NODE_WIDTH + NODE_GAP),
            y: groupNode.position.y,
          }),
        )
        return {
          nodes: [...s.nodes.filter((n) => n.id !== groupId), ...newNodes],
          edges: s.edges.filter((e) => e.source !== groupId && e.target !== groupId),
        }
      })
    })
  },

  // ── Knob interaction ──────────────────────

  triggerKnob: async (nodeId, side) => {
    const { activeKnob, ssimThreshold } = get()
    // Toggle off
    if (activeKnob?.nodeId === nodeId && activeKnob?.side === side) {
      get().clearActiveKnob()
      return
    }
    set({ activeKnob: { nodeId, side }, compatibleHandles: [] })
    try {
      const results = await api.getCompatible(nodeId, side, ssimThreshold)
      set({ compatibleHandles: results })
    } catch (e) {
      console.error('Compatibility fetch failed', e)
    }
  },

  clearActiveKnob: () => {
    set({ activeKnob: null, compatibleHandles: [] })
  },

  // ── Frame preview ─────────────────────────

  openFramePreview: (url, label) => set({ previewFrame: { url, label } }),
  closeFramePreview: () => set({ previewFrame: null }),

  // ── Panels ────────────────────────────────

  setShowTimeline: (v) => set({ showTimeline: v }),
  setShowExport: (v) => set({ showExport: v }),
  setThreshold: (t) => set({ ssimThreshold: t }),
  setExportCycles: (c) => set({ exportCycles: c }),

  // ── Export ────────────────────────────────

  runExport: async () => {
    const { exportCycles } = get()
    const result = await api.exportSequence(exportCycles)
    set({ exportResult: result })
  },
}))
