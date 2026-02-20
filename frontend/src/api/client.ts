import axios from 'axios'
import type {
  VideoNodeData,
  GroupNodeData,
  SimilarityResult,
  ExportCycle,
  ExportResponse,
} from '../types'

const api = axios.create({ baseURL: '' })

// ──────────────────────────────────────────────
// Videos
// ──────────────────────────────────────────────

export async function uploadVideos(files: FileList | File[]): Promise<VideoNodeData[]> {
  const form = new FormData()
  Array.from(files).forEach((f) => form.append('files', f))
  const { data } = await api.post<Array<{
    id: string; name: string; type: string
    video_url: string; first_frame_url: string; last_frame_url: string
    duration: number; width: number; height: number
  }>>('/api/videos', form)
  // snake_case → camelCase
  return data.map(camelifyNode) as VideoNodeData[]
}

export async function listVideos(): Promise<VideoNodeData[]> {
  const { data } = await api.get<ReturnType<typeof uploadVideos> extends Promise<infer T> ? T : never>('/api/videos')
  return (data as any[]).map(camelifyNode) as VideoNodeData[]
}

export async function renameNode(id: string, name: string): Promise<void> {
  await api.patch(`/api/videos/${id}/rename`, { name })
}

export async function deleteNode(id: string): Promise<void> {
  await api.delete(`/api/videos/${id}`)
}

// ──────────────────────────────────────────────
// Similarity
// ──────────────────────────────────────────────

export interface CompatibilityResponse {
  query_node_id: string
  query_side: 'left' | 'right'
  compatible: Array<{ node_id: string; side: 'left' | 'right'; score: number }>
}

export async function getCompatible(
  nodeId: string,
  side: 'left' | 'right',
  threshold = 0.75,
): Promise<SimilarityResult[]> {
  const { data } = await api.get<CompatibilityResponse>(
    `/api/similarity/compatible/${nodeId}`,
    { params: { side, threshold } },
  )
  return data.compatible.map((r) => ({ nodeId: r.node_id, side: r.side, score: r.score }))
}

export async function getSimilarityMatrix(): Promise<Record<string, Record<string, number>>> {
  const { data } = await api.get('/api/similarity/matrix')
  return data
}

// ──────────────────────────────────────────────
// Groups
// ──────────────────────────────────────────────

export async function createGroup(payload: {
  name: string
  childIds: string[]
  firstFrameUrl: string
  lastFrameUrl: string
  duration: number
}): Promise<GroupNodeData> {
  const { data } = await api.post('/api/groups', {
    name: payload.name,
    child_ids: payload.childIds,
    first_frame_url: payload.firstFrameUrl,
    last_frame_url: payload.lastFrameUrl,
    duration: payload.duration,
  })
  return camelifyGroup(data)
}

export async function listGroups(): Promise<GroupNodeData[]> {
  const { data } = await api.get('/api/groups')
  return (data as any[]).map(camelifyGroup)
}

export async function renameGroup(id: string, name: string): Promise<void> {
  await api.patch(`/api/groups/${id}/rename`, { name })
}

export async function deleteGroup(id: string): Promise<void> {
  await api.delete(`/api/groups/${id}`)
}

// ──────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────

export async function exportSequence(cycles: ExportCycle[]): Promise<ExportResponse> {
  const { data } = await api.post<ExportResponse>('/api/export', {
    cycles: cycles.map((c) => ({ node_ids: c.nodeIds, repeat: c.repeat })),
  })
  return data
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function camelifyNode(d: any): VideoNodeData {
  return {
    id: d.id,
    name: d.name,
    originalFilename: d.original_filename ?? '',
    type: 'video',
    videoUrl: d.video_url,
    firstFrameUrl: d.first_frame_url,
    lastFrameUrl: d.last_frame_url,
    duration: d.duration,
    width: d.width,
    height: d.height,
  }
}

function camelifyGroup(d: any): GroupNodeData {
  return {
    id: d.id,
    name: d.name,
    type: 'group',
    childIds: d.child_ids,
    firstFrameUrl: d.first_frame_url,
    lastFrameUrl: d.last_frame_url,
    duration: d.duration,
  }
}
