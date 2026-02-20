// actions.js — business logic wired to the store
import * as api from './api.js'
import { useStore, makeFlowNode } from './store.js'

function st() { return useStore.getState() }
function up(patch) { useStore.setState(patch) }

// ── Load initial data ─────────────────────────

export async function loadInitialData() {
  const [videos, groups] = await Promise.all([api.listVideos(), api.listGroups()])
  const all = [...videos, ...groups]
  const nodes = all.map((d, i) => makeFlowNode(d, autoPos(all.length, i)))
  up({ nodes })
}

function autoPos(total, index) {
  const cols = Math.min(4, Math.ceil(Math.sqrt(Math.max(total, 1))))
  const NODE_W = 440, GAP = 60
  return {
    x: 80 + (index % cols) * (NODE_W + GAP),
    y: 160 + Math.floor(index / cols) * 270,
  }
}

// ── Upload ────────────────────────────────────

export async function uploadVideosFn(files) {
  const newNodes = await api.uploadVideos(files)
  useStore.setState(s => {
    const base = s.nodes.length
    const flowNodes = newNodes.map((d, i) =>
      makeFlowNode(d, autoPos(base + newNodes.length, base + i)),
    )
    return { nodes: [...s.nodes, ...flowNodes] }
  })
}

// ── Rename ────────────────────────────────────

export async function renameNodeFn(id, name) {
  // optimistic update
  useStore.setState(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, name } } : n),
  }))
  // Sync to backend (fire&forget)
  if (useStore.getState().nodes.find(n => n.id === id)?.data.type === 'group') {
    api.renameGroup(id, name).catch(console.error)
  } else {
    api.renameNode(id, name).catch(console.error)
  }
}

// ── Delete ────────────────────────────────────

export async function deleteNodeFn(id) {
  const { nodes } = st()
  const node = nodes.find(n => n.id === id)
  useStore.setState(s => ({
    nodes: s.nodes.filter(n => n.id !== id),
    edges: s.edges.filter(e => e.source !== id && e.target !== id),
  }))
  if (node?.data.type === 'group') api.deleteGroup(id).catch(console.error)
  else api.deleteNode(id).catch(console.error)
}

// ── Group ─────────────────────────────────────

export async function groupSelectedFn() {
  const { nodes, edges } = st()
  const selected = nodes.filter(n => n.selected)
  if (selected.length < 2) return

  const selSet = new Set(selected.map(n => n.id))

  // Topological sort of selected nodes
  const intraEdges = edges.filter(e => selSet.has(e.source) && selSet.has(e.target))
  const adj = {}, inDeg = {}
  for (const n of selected) { adj[n.id] = []; inDeg[n.id] = 0 }
  for (const e of intraEdges) { adj[e.source].push(e.target); inDeg[e.target] = (inDeg[e.target] ?? 0) + 1 }
  const queue = selected.filter(n => inDeg[n.id] === 0).map(n => n.id)
  const ordered = []
  while (queue.length) {
    const cur = queue.shift(); ordered.push(cur)
    for (const next of adj[cur] ?? []) { if (--inDeg[next] === 0) queue.push(next) }
  }
  if (ordered.length !== selected.length)
    ordered.splice(0, ordered.length, ...selected.map(n => n.id))

  const firstNode = nodes.find(n => n.id === ordered[0])?.data
  const lastNode  = nodes.find(n => n.id === ordered[ordered.length - 1])?.data
  const totalDur  = ordered.reduce((s, id) => s + (nodes.find(n => n.id === id)?.data?.duration ?? 0), 0)

  const group = await api.createGroup({
    name: `Group (${ordered.length})`,
    childIds: ordered,
    firstFrameUrl: firstNode?.firstFrameUrl ?? '',
    lastFrameUrl: lastNode?.lastFrameUrl ?? '',
    duration: totalDur,
  })

  const cx = selected.reduce((s, n) => s + n.position.x, 0) / selected.length
  const cy = selected.reduce((s, n) => s + n.position.y, 0) / selected.length

  useStore.setState(s => ({
    nodes: [...s.nodes.filter(n => !selSet.has(n.id)), makeFlowNode(group, { x: cx, y: cy })],
    edges: s.edges.filter(e => !selSet.has(e.source) || !selSet.has(e.target)),
  }))
}

// ── Ungroup ───────────────────────────────────

export async function ungroupNodeFn(groupId) {
  const { nodes } = st()
  const gNode = nodes.find(n => n.id === groupId)
  if (!gNode || gNode.data.type !== 'group') return
  const childIds = gNode.data.childIds

  api.deleteGroup(groupId).catch(console.error)

  const videos = await api.listVideos()
  const toAdd = videos.filter(v => childIds.includes(v.id))
  const newNodes = toAdd.map((d, i) => makeFlowNode(d, {
    x: gNode.position.x + i * 500,
    y: gNode.position.y + 20,
  }))

  useStore.setState(s => ({
    nodes: [...s.nodes.filter(n => n.id !== groupId), ...newNodes],
    edges: s.edges.filter(e => e.source !== groupId && e.target !== groupId),
  }))
}

// ── Knob trigger ──────────────────────────────

export async function triggerKnob(nodeId, side) {
  const { activeKnob, ssimThreshold } = st()
  if (activeKnob?.nodeId === nodeId && activeKnob?.side === side) {
    useStore.getState().clearActiveKnob()
    return
  }
  up({ activeKnob: { nodeId, side }, compatibleHandles: [] })
  try {
    const results = await api.getCompatible(nodeId, side, ssimThreshold)
    up({ compatibleHandles: results })
  } catch (e) {
    console.error('Compatibility fetch failed', e)
  }
}

// ── Export ────────────────────────────────────

export async function runExportFn() {
  const { exportCycles } = st()
  const result = await api.exportSequence(exportCycles)
  up({ exportResult: result })
  return result
}

// ── Wire actions into store ───────────────────
// Call this once at app startup
export function initActions() {
  useStore.setState({
    triggerKnob,
    loadInitialData,
    uploadVideosFn,
    renameNodeFn,
    deleteNodeFn,
    groupSelectedFn,
    ungroupNodeFn,
    runExportFn,
  })
}
