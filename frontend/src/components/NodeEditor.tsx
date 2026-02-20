import { useCallback, useMemo, useEffect } from 'react'
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
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store/useStore'
import { VideoNode } from './VideoNode'
import { GroupNode } from './GroupNode'
import type { VideoFlowNodeData, GroupFlowNodeData, NodeData } from '../types'
import type { Node } from '@xyflow/react'

// ──────────────────────────────────────────────
// Custom edge with gradient colour
// ──────────────────────────────────────────────

function LoopEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <>
      <defs>
        <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: selected ? '#10b981' : `url(#grad-${id})`,
          strokeWidth: selected ? 3 : 2,
          filter: selected ? 'drop-shadow(0 0 4px #10b981)' : undefined,
        }}
      />
    </>
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
  const renameNode = useStore((s) => s.renameNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const groupSelected = useStore((s) => s.groupSelected)
  const ungroupNode = useStore((s) => s.ungroupNode)
  const clearActiveKnob = useStore((s) => s.clearActiveKnob)
  const activeKnob = useStore((s) => s.activeKnob)
  const selectedNodeIds = useStore((s) => s.selectedNodeIds)
  const loadInitialData = useStore((s) => s.loadInitialData)

  // On mount, load persisted nodes from server
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Inject action callbacks into node data
  const nodesWithCallbacks = useMemo<Node[]>(() => {
    return nodes.map((n) => {
      if (n.data.type === 'video') {
        return {
          ...n,
          data: {
            ...(n.data as VideoFlowNodeData),
            onPreviewFrame: openFramePreview,
            onRename: renameNode,
            onDelete: deleteNode,
          } as VideoFlowNodeData,
        }
      } else {
        return {
          ...n,
          data: {
            ...(n.data as GroupFlowNodeData),
            onPreviewFrame: openFramePreview,
            onRename: (id: string, name: string) => {
              // update group name via store
              useStore.getState().renameNode(id, name)
            },
            onDelete: (id: string) => deleteNode(id),
            onUngroup: ungroupNode,
          } as GroupFlowNodeData,
        }
      }
    })
  }, [nodes, openFramePreview, renameNode, deleteNode, ungroupNode])

  const nodeTypes = useMemo<NodeTypes>(
    () => ({ videoNode: VideoNode, groupNode: GroupNode }),
    [],
  )

  const edgeTypes = useMemo<EdgeTypes>(
    () => ({ loopEdge: LoopEdge }),
    [],
  )

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'loopEdge',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    }),
    [],
  )

  // Click on empty canvas → clear active knob
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
            Connecting from <strong>{activeKnob.side}</strong> knob of node…
            <button onClick={clearActiveKnob} className="ml-1 hover:text-text transition-colors">✕</button>
          </div>
        )}
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
