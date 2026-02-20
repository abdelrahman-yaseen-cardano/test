// ──────────────────────────────────────────────
// Domain types
// ──────────────────────────────────────────────

export interface VideoNodeData {
  id: string
  name: string
  type: 'video'
  videoUrl: string
  firstFrameUrl: string
  lastFrameUrl: string
  duration: number
  width: number
  height: number
}

export interface GroupNodeData {
  id: string
  name: string
  type: 'group'
  childIds: string[]
  firstFrameUrl: string
  lastFrameUrl: string
  duration: number
}

export type NodeData = VideoNodeData | GroupNodeData

// ──────────────────────────────────────────────
// React Flow node data shapes
// ──────────────────────────────────────────────

export interface VideoFlowNodeData extends VideoNodeData {
  onPreviewFrame: (url: string, label: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export interface GroupFlowNodeData extends GroupNodeData {
  onPreviewFrame: (url: string, label: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onUngroup: (id: string) => void
}

// ──────────────────────────────────────────────
// Similarity / connection types
// ──────────────────────────────────────────────

export interface SimilarityResult {
  nodeId: string
  side: 'left' | 'right'
  score: number
}

export type KnobSide = 'left' | 'right'

/** What the store tracks when a user is in the middle of connecting */
export interface ActiveKnob {
  nodeId: string
  side: KnobSide
}

// ──────────────────────────────────────────────
// Export types
// ──────────────────────────────────────────────

export interface ExportCycle {
  nodeIds: string[]
  repeat: number
}

export interface TimelineEntry {
  node_id: string
  name: string
  start: number
  end: number
  cycle_index: number
  repeat_index: number
}

export interface ExportResponse {
  entries: {
    node_id: string
    name: string
    type: string
    video_url: string
    duration: number
    cycle_index: number
    repeat_index: number
  }[]
  total_duration: number
  timeline: TimelineEntry[]
}
