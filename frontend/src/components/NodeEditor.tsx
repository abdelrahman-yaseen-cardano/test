import { useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
  BaseEdge,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store/useStore'
import { VideoNode } from './VideoNode'
import { GroupNode } from './GroupNode'
import type { VideoFlowNodeData, GroupFlowNodeData, NodeData } from '../types'
import type { Node, Edge } from '@xyflow/react'

// ──────────────────────────────────────────────
// Waypoint edge with drag-to-create snap joints
// ──────────────────────────────────────────────

function WaypointEdge({
  id, sourceX, sourceY, targetX, targetY, data, selected,
}: EdgeProps) {
  const addWaypoint = useStore((s) => s.addEdgeWaypoint)
  const updateWaypoint = useStore((s) => s.updateEdgeWaypoint)
  const removeWaypoint = useStore((s) => s.removeEdgeWaypoint)
  const { screenToFlowPosition } = useReactFlow()

  const waypoints: { x: number; y: number }[] = (data?.waypoints as any[]) ?? []
  const isSelfLoop: boolean = !!(data?.isSelfLoop)

  // Build poly-line path through all waypoints
  const buildPath = () => {
    if (isSelfLoop) {
      // Self-loop: draw a small arc above the source handle
      const r = 60
      return `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY - r * 2}, ${targetX} ${targetY - r * 2}, ${targetX} ${targetY}`
    }
    if (waypoints.length === 0) {
      // Simple bezier
      const cx = (sourceX + targetX) / 2
      return `M ${sourceX} ${sourceY} C ${cx} ${sourceY}, ${cx} ${targetY}, ${targetX} ${targetY}`
    }
    const pts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i]
      const prev = pts[i - 1]
      const mx = (prev.x + p.x) / 2
      d += ` C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`
    }
    return d
  }

  const path = buildPath()

  // Double-click on the edge path to add a new waypoint
  const handleEdgeDoubleClick = (e: React.MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addWaypoint(id, pos)
  }

  // Drag a waypoint
  const startDragWaypoint = (e: React.MouseEvent, wpIndex: number) => {
    e.stopPropagation()
    const onMove = (me: MouseEvent) => {
      const pos = screenToFlowPosition({ x: me.clientX, y: me.clientY })
      updateWaypoint(id, wpIndex, pos)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const strokeColor = selected ? '#10b981' : isSelfLoop ? '#f59e0b' : '#6366f1'

  return (
    <g>
      <defs>
        <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Invisible wider hit-area path for double-click */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        style={{ cursor: 'crosshair' }}
        onDoubleClick={handleEdgeDoubleClick}
      />

      {/* Visible edge */}
      <BaseEdge
        path={path}
        style={{
          stroke: selected ? '#10b981' : isSelfLoop ? '#f59e0b' : `url(#grad-${id})`,
          strokeWidth: selected ? 3 : 2,
          filter: selected ? 'drop-shadow(0 0 4px #10b981)' : undefined,
          strokeDasharray: isSelfLoop ? '6 3' : undefined,
        }}
        markerEnd={`url(#arrow-${id})`}
      />

      {/* Arrow marker */}
      <defs>
        <marker id={`arrow-${id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={strokeColor} />
        </marker>
      </defs>

      {/* Waypoint drag handles */}
      {waypoints.map((wp, i) => (
        <g key={i}>
          <circle
            cx={wp.x}
            cy={wp.y}
            r={8}
            fill="#1e1e2e"
            stroke="#6366f1"
            strokeWidth={2}
            style={{ cursor: 'move' }}
            onMouseDown={(e) => startDragWaypoint(e, i)}
          />
          <circle
            cx={wp.x}
            cy={wp.y}
            r={3}
            fill="#6366f1"
            style={{ cursor: 'move', pointerEvents: 'none' }}
          />
          {/* Remove waypoint × */}
          <text
            x={wp.x + 10}
            y={wp.y - 10}
            fontSize="10"
            fill="#ef4444"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={(e) => { e.stopPropagation(); removeWaypoint(id, i) }}
          >
            ×
          </text>
        </g>
      ))}
    </g>
  )
}

// ──────────────────────────────────────────────
// Node Editor
// ──────────────────────────────────────────────

export function NodeEditor() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const onConnect = useStore((s) => s.onConnect)
  const openFramePreview = useStore((s) => s.openFramePreview)
  const openVideoPreview = useStore((s) => s.openVideoPreview)
  const renameNode = useStore((s) => s.renameNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const groupSelected = useStore((s) => s.groupSelected)
  const ungroupNode = useStore((s) => s.ungroupNode)
  const clearActiveKnob = useStore((s) => s.clearActiveKnob)
  const activeKnob = useStore((s) => s.activeKnob)
  const selectedNodeIds = useStore((s) => s.selectedNodeIds)
  const loadInitialData = useStore((s) => s.loadInitialData)
  const addToTimeline = useStore((s) => s.addToTimeline)
  const duplicateInTimeline = useStore((s) => s.duplicateInTimeline)
  const timelineSlots = useStore((s) => s.timelineSlots)
  const setExpandedGroupId = useStore((s) => s.setExpandedGroupId)

  useEffect(() => { loadInitialData() }, [loadInitialData])

  // Build per-node timeline positions map
  const timelinePositionMap = useMemo(() => {
    const map: Record<string, number[]> = {}
    timelineSlots.forEach((sl, idx) => {
      if (!map[sl.nodeId]) map[sl.nodeId] = []
      map[sl.nodeId].push(idx)
    })
    return map
  }, [timelineSlots])

  // Inject action callbacks into node data
  const nodesWithCallbacks = useMemo<Node[]>(() => {
    return nodes.map((n) => {
      const basePositions = timelinePositionMap[n.id] ?? []
      if (n.data.type === 'video') {
        return {
          ...n,
          data: {
            ...(n.data as VideoFlowNodeData),
            onPreviewFrame: openFramePreview,
            onPreviewVideo: openVideoPreview,
            onRename: renameNode,
            onDelete: deleteNode,
            onAddToTimeline: addToTimeline,
            onDuplicateToTimeline: duplicateInTimeline,
            timelinePositions: basePositions,
          } as VideoFlowNodeData,
        }
      } else {
        return {
          ...n,
          data: {
            ...(n.data as GroupFlowNodeData),
            onPreviewFrame: openFramePreview,
            onRename: (id: string, name: string) => useStore.getState().renameNode(id, name),
            onDelete: (id: string) => deleteNode(id),
            onUngroup: ungroupNode,
            onExpand: setExpandedGroupId,
            onAddToTimeline: addToTimeline,
            timelinePositions: basePositions,
          } as GroupFlowNodeData,
        }
      }
    })
  }, [nodes, openFramePreview, openVideoPreview, renameNode, deleteNode, ungroupNode,
    addToTimeline, duplicateInTimeline, timelinePositionMap, setExpandedGroupId])

  const nodeTypes = useMemo<NodeTypes>(
    () => ({ videoNode: VideoNode, groupNode: GroupNode }),
    [],
  )

  const edgeTypes = useMemo<EdgeTypes>(
    () => ({ waypointEdge: WaypointEdge }),
    [],
  )

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'waypointEdge',
      animated: false,
      data: { waypoints: [] },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    }),
    [],
  )

  const onPaneClick = useCallback(() => {
    if (activeKnob) clearActiveKnob()
  }, [activeKnob, clearActiveKnob])

  const canGroup = selectedNodeIds.length >= 2

  return (
    <div className="relative w-full h-full">
      {/* Toolbar overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        {canGroup && (
          <button
            onClick={groupSelected}
            className="
              px-3 py-1.5 rounded-lg text-xs font-medium
              bg-warning/10 border border-warning/40 text-warning
              hover:bg-warning/20 transition-colors
            "
          >
            ⊞ Group {selectedNodeIds.length} selected
          </button>
        )}
        {activeKnob && (
          <div className="px-3 py-1.5 rounded-lg text-xs bg-primary/10 border border-primary/40 text-primary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Connecting from <strong>{activeKnob.side}</strong> knob…
            <button onClick={clearActiveKnob} className="ml-1 hover:text-text transition-colors">✕</button>
          </div>
        )}
        <div className="px-2 py-1.5 rounded-lg text-[10px] bg-surface/80 border border-border text-textMuted">
          Double-click an edge to add a snap joint
        </div>
      </div>

      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        panOnScroll
        selectionOnDrag
        panOnDrag={[1, 2]}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#2e2e3e"
        />
        <Controls className="bottom-4 left-4" />
        <MiniMap
          nodeColor={(n) => n.data?.type === 'group' ? '#f59e0b' : '#6366f1'}
          maskColor="rgba(15,15,19,0.7)"
          className="bottom-4 right-4"
        />
      </ReactFlow>
    </div>
  )
}