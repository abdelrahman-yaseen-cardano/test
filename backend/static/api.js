// api.js — all backend API calls

const BASE = ''

async function request(method, path, body, params) {
  let url = BASE + path
  if (params) {
    const q = new URLSearchParams(params)
    url += '?' + q.toString()
  }
  const opts = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }
  if (body instanceof FormData) {
    opts.headers = undefined
    opts.body = body
  }
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(err.detail ?? res.statusText), { status: res.status })
  }
  if (res.status === 204) return null
  return res.json()
}

// ── camelify helpers ─────────────────────────

function camelifyNode(d) {
  return {
    id: d.id, name: d.name, type: 'video',
    videoUrl: d.video_url, firstFrameUrl: d.first_frame_url, lastFrameUrl: d.last_frame_url,
    duration: d.duration, width: d.width, height: d.height,
  }
}
function camelifyGroup(d) {
  return {
    id: d.id, name: d.name, type: 'group',
    childIds: d.child_ids, firstFrameUrl: d.first_frame_url,
    lastFrameUrl: d.last_frame_url, duration: d.duration,
  }
}

// ── Videos ───────────────────────────────────

export async function uploadVideos(files) {
  const form = new FormData()
  Array.from(files).forEach(f => form.append('files', f))
  const data = await request('POST', '/api/videos', form)
  return data.map(camelifyNode)
}

export async function listVideos() {
  const data = await request('GET', '/api/videos')
  return data.map(camelifyNode)
}

export async function renameNode(id, name) {
  await request('PATCH', `/api/videos/${id}/rename`, { name })
}

export async function deleteNode(id) {
  await request('DELETE', `/api/videos/${id}`)
}

// ── Similarity ────────────────────────────────

export async function getCompatible(nodeId, side, threshold = 0.75) {
  const data = await request('GET', `/api/similarity/compatible/${nodeId}`, null, { side, threshold })
  return data.compatible.map(r => ({ nodeId: r.node_id, side: r.side, score: r.score }))
}

// ── Groups ────────────────────────────────────

export async function createGroup(payload) {
  const data = await request('POST', '/api/groups', {
    name: payload.name, child_ids: payload.childIds,
    first_frame_url: payload.firstFrameUrl, last_frame_url: payload.lastFrameUrl,
    duration: payload.duration,
  })
  return camelifyGroup(data)
}

export async function listGroups() {
  const data = await request('GET', '/api/groups')
  return data.map(camelifyGroup)
}

export async function renameGroup(id, name) {
  await request('PATCH', `/api/groups/${id}/rename`, { name })
}

export async function deleteGroup(id) {
  await request('DELETE', `/api/groups/${id}`)
}

// ── Export ────────────────────────────────────

export async function exportSequence(cycles) {
  return request('POST', '/api/export', {
    cycles: cycles.map(c => ({ node_ids: c.nodeIds, repeat: c.repeat })),
  })
}
