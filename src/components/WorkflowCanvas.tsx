import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import {
  Background,
  Controls,
  type EdgeChange,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

import { useWorkflowState } from '../hooks';
import { workflowNodeTypes } from '../nodes';
import {
  NodeType,
  type NodeData,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowState,
} from '../types';

type WorkflowActions = ReturnType<typeof useWorkflowState>['actions'];
type WorkflowNodeDragHandler = (
  event: ReactMouseEvent<Element, MouseEvent> | ReactTouchEvent<Element>,
  node: WorkflowNode,
) => void;

interface WorkflowCanvasProps {
  actions: WorkflowActions;
  edges: WorkflowEdge[];
  focusNodeId: string | null;
  focusNodeRequestKey: number;
  nodes: WorkflowNode[];
  onStartFromScratch: () => void;
  workflowState: WorkflowState;
  workflowNodes: WorkflowNode[];
  onSelectNode: (nodeId: string | null) => void;
}

const AUTO_LAYOUT_GAP_X = 292;
const AUTO_LAYOUT_GAP_Y = 170;
const AUTO_LAYOUT_START_X = 80;
const AUTO_LAYOUT_DEFAULT_Y = 180;
const DETACHED_CLUSTER_GAP_Y = 240;
const AUTO_INSERT_ORDER: Record<NodeType, number> = {
  [NodeType.START]: 0,
  [NodeType.TASK]: 1,
  [NodeType.APPROVAL]: 2,
  [NodeType.AUTOMATED_STEP]: 3,
  [NodeType.END]: 4,
};

const defaultEdgeStyle = {
  type: 'smoothstep' as const,
  animated: false,
  style: {
    stroke: '#b7c4d8',
    strokeWidth: 2,
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#b7c4d8',
  },
};

function createDefaultNodeData(nodeType: NodeType): NodeData {
  switch (nodeType) {
    case NodeType.START:
      return {
        nodeType: NodeType.START,
        config: {
          title: 'Workflow Start',
          metadata: {},
        },
      };
    case NodeType.TASK:
      return {
        nodeType: NodeType.TASK,
        config: {
          title: 'New Task',
          description: '',
          assignee: '',
          dueDate: '',
          customFields: {},
        },
      };
    case NodeType.APPROVAL:
      return {
        nodeType: NodeType.APPROVAL,
        config: {
          title: 'Approval',
          approverRole: 'Manager',
          autoApproveThreshold: 0,
        },
      };
    case NodeType.AUTOMATED_STEP:
      return {
        nodeType: NodeType.AUTOMATED_STEP,
        config: {
          title: 'Automated Step',
          actionId: '',
          parameters: {},
        },
      };
    case NodeType.END:
      return {
        nodeType: NodeType.END,
        config: {
          endMessage: 'Workflow Complete',
          summaryFlag: false,
        },
      };
    default:
      return {
        nodeType: NodeType.TASK,
        config: {
          title: 'New Task',
          description: '',
          assignee: '',
          dueDate: '',
          customFields: {},
        },
      };
  }
}

function createWorkflowEdge(connection: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): WorkflowEdge {
  return {
    id: uuidv4(),
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? null,
    targetHandle: connection.targetHandle ?? null,
    ...defaultEdgeStyle,
  };
}

function canAutoConnect(sourceNode: WorkflowNode, nextNodeType: NodeType) {
  return sourceNode.type !== NodeType.END && nextNodeType !== NodeType.START;
}

function getLinearBaseY(nodes: WorkflowNode[], fallbackY: number) {
  if (nodes.length === 0) {
    return fallbackY;
  }

  return nodes
    .map((node) => node.position.y)
    .sort((left, right) => left - right)[0] ?? fallbackY;
}

function sortNodesByWorkflowOrder(nodes: WorkflowNode[]) {
  return [...nodes].sort((left, right) => {
    const orderDifference = AUTO_INSERT_ORDER[left.type] - AUTO_INSERT_ORDER[right.type];
    if (orderDifference !== 0) {
      return orderDifference;
    }

    return left.position.x - right.position.x;
  });
}

export function canUseAutoOrderedInsertion(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nextNodeType: NodeType,
) {
  if (nodes.length === 0) {
    return false;
  }

  if (nodes.some((node) => node.type === nextNodeType)) {
    return false;
  }

  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();

  nodes.forEach((node) => {
    incomingCount.set(node.id, 0);
    outgoingCount.set(node.id, 0);
  });

  for (const edge of edges) {
    if (!incomingCount.has(edge.source) || !incomingCount.has(edge.target)) {
      return false;
    }

    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);

    if ((outgoingCount.get(edge.source) ?? 0) > 1 || (incomingCount.get(edge.target) ?? 0) > 1) {
      return false;
    }
  }

  return edges.length <= Math.max(0, nodes.length - 1);
}

export function buildAutoOrderedWorkflow(
  nodes: WorkflowNode[],
  newNode: WorkflowNode,
  fallbackY = AUTO_LAYOUT_DEFAULT_Y,
): WorkflowDefinition {
  const orderedNodes = sortNodesByWorkflowOrder([...nodes, newNode]);
  const baseY = getLinearBaseY(nodes, fallbackY);
  const baseX = nodes.length > 0 ? Math.min(...nodes.map((node) => node.position.x)) : AUTO_LAYOUT_START_X;

  const positionedNodes = orderedNodes.map((node, index) => ({
    ...node,
    position: {
      x: baseX + index * AUTO_LAYOUT_GAP_X,
      y: baseY,
    },
  }));

  return {
    nodes: positionedNodes,
    edges: positionedNodes.slice(0, -1).map((node, index) =>
      createWorkflowEdge({
        source: node.id,
        target: positionedNodes[index + 1].id,
      }),
    ),
  };
}

function getConnectedWorkflowGroup(
  anchorNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
) {
  const adjacency = new Map<string, string[]>();

  nodes.forEach((node) => adjacency.set(node.id, []));
  edges.forEach((edge) => {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  });

  const queue = [anchorNodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    for (const nextId of adjacency.get(currentId) ?? []) {
      if (!visited.has(nextId)) {
        queue.push(nextId);
      }
    }
  }

  return {
    nodes: nodes.filter((node) => visited.has(node.id)),
    edges: edges.filter((edge) => visited.has(edge.source) && visited.has(edge.target)),
  };
}

function getConnectedWorkflowGroupIds(
  anchorNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
) {
  return new Set(getConnectedWorkflowGroup(anchorNodeId, nodes, edges).nodes.map((node) => node.id));
}

export function shouldDetachNodeFromWorkflowGroup(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  anchorNodeId: string,
  nextNodeType: NodeType,
) {
  if (nextNodeType === NodeType.START) {
    return true;
  }

  const group = getConnectedWorkflowGroup(anchorNodeId, nodes, edges);
  return group.nodes.some((node) => node.type === nextNodeType);
}

export function buildAutoOrderedWorkflowGroup(
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
  anchorNodeId: string,
  newNode: WorkflowNode,
  fallbackY = AUTO_LAYOUT_DEFAULT_Y,
): WorkflowDefinition | null {
  const group = getConnectedWorkflowGroup(anchorNodeId, allNodes, allEdges);
  if (!canUseAutoOrderedInsertion(group.nodes, group.edges, newNode.type)) {
    return null;
  }

  const orderedGroup = buildAutoOrderedWorkflow(group.nodes, newNode, fallbackY);
  const groupIds = new Set(group.nodes.map((node) => node.id));

  return {
    nodes: [
      ...allNodes.filter((node) => !groupIds.has(node.id)),
      ...orderedGroup.nodes,
    ],
    edges: [
      ...allEdges.filter((edge) => !groupIds.has(edge.source) && !groupIds.has(edge.target)),
      ...orderedGroup.edges,
    ],
  };
}

export function moveWorkflowGroup(
  allNodes: WorkflowNode[],
  groupIds: Set<string>,
  startPositions: Record<string, { x: number; y: number }>,
  delta: { x: number; y: number },
): WorkflowDefinition | null {
  if (delta.x === 0 && delta.y === 0) {
    return null;
  }

  return {
    nodes: allNodes.map((node) =>
      groupIds.has(node.id) && startPositions[node.id]
        ? {
            ...node,
            position: {
              x: startPositions[node.id].x + delta.x,
              y: startPositions[node.id].y + delta.y,
            },
          }
        : node,
    ),
    edges: [],
  };
}

function getDetachedClusterPosition(nodes: WorkflowNode[], nodeType: NodeType) {
  const nextY =
    nodes.length === 0
      ? AUTO_LAYOUT_DEFAULT_Y
      : Math.max(...nodes.map((node) => node.position.y)) + DETACHED_CLUSTER_GAP_Y;

  return {
    x: AUTO_LAYOUT_START_X + AUTO_INSERT_ORDER[nodeType] * AUTO_LAYOUT_GAP_X,
    y: nextY,
  };
}

export function filterGroupDragNodeChanges(
  changes: NodeChange<WorkflowNode>[],
  activeGroupIds: Set<string> | null,
  suppressedGroupIds: Set<string> | null,
) {
  if (!activeGroupIds && !suppressedGroupIds) {
    return changes;
  }

  return changes.filter((change) => {
    if (change.type !== 'position') {
      return true;
    }

    return !activeGroupIds?.has(change.id) && !suppressedGroupIds?.has(change.id);
  });
}

export function filterMeaningfulNodeChanges(changes: NodeChange<WorkflowNode>[]) {
  return changes.filter((change) => change.type === 'position' || change.type === 'remove');
}

export function filterMeaningfulEdgeChanges(changes: EdgeChange<WorkflowEdge>[]) {
  return changes.filter((change) => change.type === 'remove');
}

export function mergeRenderPreviewNodes(
  renderNodes: WorkflowNode[],
  previewNodes: WorkflowNode[],
  skippedNodeId?: string | null,
) {
  const previewNodeMap = new Map(previewNodes.map((node) => [node.id, node]));

  return renderNodes.map((renderNode) => {
    if (skippedNodeId && renderNode.id === skippedNodeId) {
      return renderNode;
    }

    const previewNode = previewNodeMap.get(renderNode.id);
    if (!previewNode) {
      return renderNode;
    }

    if (
      renderNode.position.x === previewNode.position.x &&
      renderNode.position.y === previewNode.position.y
    ) {
      return renderNode;
    }

    return {
      ...renderNode,
      position: previewNode.position,
    };
  });
}

function getBranchAwarePosition(
  nodeType: NodeType,
  selectedAnchorNode: WorkflowNode | undefined,
  lastNode: WorkflowNode | null,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  droppedPosition: { x: number; y: number },
) {
  if (nodeType === NodeType.START) {
    return droppedPosition;
  }

  if (selectedAnchorNode) {
    const childNodes = edges
      .filter((edge) => edge.source === selectedAnchorNode.id)
      .map((edge) => nodes.find((node) => node.id === edge.target))
      .filter((node): node is WorkflowNode => Boolean(node));

    if (childNodes.length === 0) {
      return {
        x: selectedAnchorNode.position.x + AUTO_LAYOUT_GAP_X,
        y: selectedAnchorNode.position.y,
      };
    }

    const nextBranchY =
      childNodes
        .map((node) => node.position.y)
        .sort((left, right) => left - right)
        .at(-1) ?? selectedAnchorNode.position.y;

    return {
      x: selectedAnchorNode.position.x + AUTO_LAYOUT_GAP_X,
      y: nextBranchY + AUTO_LAYOUT_GAP_Y,
    };
  }

  if (lastNode) {
    return {
      x: lastNode.position.x + AUTO_LAYOUT_GAP_X,
      y: lastNode.position.y,
    };
  }

  return droppedPosition;
}

export function WorkflowCanvas({
  actions,
  edges,
  focusNodeId,
  focusNodeRequestKey,
  nodes,
  onStartFromScratch,
  workflowState,
  workflowNodes,
  onSelectNode,
}: WorkflowCanvasProps) {
  const [reactFlowInstance, setReactFlowInstance] = useState<
    ReactFlowInstance<WorkflowNode, WorkflowEdge> | null
  >(null);
  const [dragPreviewNodes, setDragPreviewNodes] = useState<WorkflowNode[] | null>(null);
  const [dragPreviewAnchorId, setDragPreviewAnchorId] = useState<string | null>(null);
  const dragStartPositionRef = useRef<{
    anchorNodeId: string;
    groupIds: Set<string>;
    positions: Record<string, { x: number; y: number }>;
    historyBase: WorkflowState;
  } | null>(null);
  const suppressedPositionChangeIdsRef = useRef<Set<string> | null>(null);
  const suppressedPositionCleanupRef = useRef<number | null>(null);
  const selectionLockRef = useRef(false);
  const selectionLockCleanupRef = useRef<number | null>(null);
  const displayNodes = useMemo(
    () =>
      dragPreviewNodes
        ? mergeRenderPreviewNodes(nodes, dragPreviewNodes, dragPreviewAnchorId)
        : nodes,
    [dragPreviewAnchorId, dragPreviewNodes, nodes],
  );

  useEffect(() => {
    return () => {
      if (suppressedPositionCleanupRef.current !== null) {
        window.clearTimeout(suppressedPositionCleanupRef.current);
      }

      if (selectionLockCleanupRef.current !== null) {
        window.clearTimeout(selectionLockCleanupRef.current);
      }
    };
  }, []);

  const scheduleSelectionUnlock = () => {
    if (selectionLockCleanupRef.current !== null) {
      window.clearTimeout(selectionLockCleanupRef.current);
    }

    selectionLockCleanupRef.current = window.setTimeout(() => {
      selectionLockRef.current = false;
      selectionLockCleanupRef.current = null;
    }, 80);
  };

  useEffect(() => {
    if (dragStartPositionRef.current) {
      return;
    }

    setDragPreviewNodes(null);
    setDragPreviewAnchorId(null);
  }, [nodes]);

  useEffect(() => {
    if (!reactFlowInstance || !focusNodeId) {
      return;
    }

    const node = displayNodes.find((currentNode) => currentNode.id === focusNodeId);
    if (!node) {
      return;
    }

    reactFlowInstance.setCenter(node.position.x + 90, node.position.y + 40, {
      duration: 500,
      zoom: 1.15,
    });
  }, [displayNodes, focusNodeId, focusNodeRequestKey, reactFlowInstance]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const nodeType = event.dataTransfer.getData('application/reactflow') as NodeType;
    if (!nodeType || !reactFlowInstance) {
      return;
    }

    const droppedPosition = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const selectedAnchorNode = workflowState.selectedNodeId
      ? workflowNodes.find((node) => node.id === workflowState.selectedNodeId)
      : undefined;
    const lastNode = workflowNodes.length > 0 ? workflowNodes[workflowNodes.length - 1] : null;
    const anchorNode = selectedAnchorNode ?? lastNode;
    const shouldDetachFromAnchor =
      anchorNode !== null &&
      anchorNode !== undefined &&
      shouldDetachNodeFromWorkflowGroup(workflowNodes, edges, anchorNode.id, nodeType);
    const insertionAnchorNode = shouldDetachFromAnchor ? null : anchorNode;

    const position = shouldDetachFromAnchor
      ? getDetachedClusterPosition(workflowNodes, nodeType)
      : getBranchAwarePosition(
          nodeType,
          selectedAnchorNode,
          lastNode,
          workflowNodes,
          edges,
          droppedPosition,
        );

    const node: WorkflowNode = {
      id: uuidv4(),
      type: nodeType,
      position,
      data: createDefaultNodeData(nodeType),
    };

    if (nodeType !== NodeType.START && insertionAnchorNode) {
      const autoOrderedWorkflow = buildAutoOrderedWorkflowGroup(
        workflowNodes,
        edges,
        insertionAnchorNode.id,
        node,
        droppedPosition.y,
      );

      if (autoOrderedWorkflow) {
        actions.replaceWorkflow(autoOrderedWorkflow, 'Auto ordered', true);
        onSelectNode(node.id);
        return;
      }
    }

    const autoConnectEdge =
      insertionAnchorNode && canAutoConnect(insertionAnchorNode, node.type)
        ? createWorkflowEdge({
            source: insertionAnchorNode.id,
            target: node.id,
          })
        : null;

    actions.addNode(node, autoConnectEdge);

    onSelectNode(node.id);
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }

    actions.addEdge(createWorkflowEdge(connection));
  };

  const handleNodesChange = (changes: NodeChange<WorkflowNode>[]) => {
    const filteredChanges = filterMeaningfulNodeChanges(
      filterGroupDragNodeChanges(
        changes,
        dragStartPositionRef.current?.groupIds ?? null,
        suppressedPositionChangeIdsRef.current,
      ),
    );

    if (filteredChanges.length > 0) {
      actions.applyNodeChanges(filteredChanges);
    }
  };

  const handleEdgesChange = (changes: EdgeChange<WorkflowEdge>[]) => {
    const filteredChanges = filterMeaningfulEdgeChanges(changes);

    if (filteredChanges.length > 0) {
      actions.applyEdgeChanges(filteredChanges);
    }
  };

  const handleNodeDragStart: WorkflowNodeDragHandler = (_, node) => {
    if (suppressedPositionCleanupRef.current !== null) {
      window.clearTimeout(suppressedPositionCleanupRef.current);
      suppressedPositionCleanupRef.current = null;
    }

    if (selectionLockCleanupRef.current !== null) {
      window.clearTimeout(selectionLockCleanupRef.current);
      selectionLockCleanupRef.current = null;
    }

    selectionLockRef.current = true;
    suppressedPositionChangeIdsRef.current = null;
    setDragPreviewNodes(null);
    setDragPreviewAnchorId(null);

    const groupIds = getConnectedWorkflowGroupIds(node.id, workflowNodes, edges);
    dragStartPositionRef.current = {
      anchorNodeId: node.id,
      groupIds,
      positions: Object.fromEntries(
        workflowNodes
          .filter((currentNode) => groupIds.has(currentNode.id))
          .map((currentNode) => [currentNode.id, { ...currentNode.position }]),
      ),
      historyBase: structuredClone(workflowState),
    };
  };

  const handleNodeDragStop: WorkflowNodeDragHandler = (_, node) => {
    if (!dragStartPositionRef.current) {
      scheduleSelectionUnlock();
      dragStartPositionRef.current = null;
      return;
    }

    const { groupIds, historyBase, positions } = dragStartPositionRef.current;
    const anchorStartPosition = positions[node.id];
    if (!anchorStartPosition) {
      dragStartPositionRef.current = null;
      return;
    }

    const delta = {
      x: node.position.x - anchorStartPosition.x,
      y: node.position.y - anchorStartPosition.y,
    };

    suppressedPositionChangeIdsRef.current = new Set(groupIds);
    if (suppressedPositionCleanupRef.current !== null) {
      window.clearTimeout(suppressedPositionCleanupRef.current);
    }
    suppressedPositionCleanupRef.current = window.setTimeout(() => {
      suppressedPositionChangeIdsRef.current = null;
      suppressedPositionCleanupRef.current = null;
    }, 0);

    scheduleSelectionUnlock();
    dragStartPositionRef.current = null;
    setDragPreviewNodes(null);
    setDragPreviewAnchorId(null);

    const movedWorkflow = moveWorkflowGroup(workflowNodes, groupIds, positions, delta);
    if (!movedWorkflow) {
      return;
    }

    actions.replaceWorkflow(
      {
        nodes: movedWorkflow.nodes,
        edges: edges.map((edge) => ({ ...edge })),
      },
      'Moved workflow group',
      true,
      true,
      true,
      historyBase,
    );
  };

  const handleNodeDrag: WorkflowNodeDragHandler = (_, node) => {
    if (!dragStartPositionRef.current) {
      return;
    }

    const { anchorNodeId, groupIds, positions } = dragStartPositionRef.current;
    const anchorStartPosition = positions[node.id];
    if (!anchorStartPosition) {
      return;
    }

    const delta = {
      x: node.position.x - anchorStartPosition.x,
      y: node.position.y - anchorStartPosition.y,
    };

    const movedWorkflow = moveWorkflowGroup(workflowNodes, groupIds, positions, delta);
    if (!movedWorkflow) {
      setDragPreviewNodes(null);
      setDragPreviewAnchorId(null);
      return;
    }

    setDragPreviewNodes(movedWorkflow.nodes);
    setDragPreviewAnchorId(anchorNodeId);
  };

  return (
    <div className="workflow-canvas" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
      {nodes.length === 0 ? (
        <div className="canvas-empty-state">
          <h3>Choose a template from the left or start from scratch</h3>
          <p>Use a template from the left, or drop a Start node to begin.</p>
          <div className="canvas-empty-state__actions">
            <button type="button" className="button" onClick={onStartFromScratch}>
              Start from Scratch
            </button>
          </div>
        </div>
      ) : null}
      <ReactFlow<WorkflowNode, WorkflowEdge>
        nodes={displayNodes}
        edges={edges}
        nodeTypes={workflowNodeTypes}
        onInit={setReactFlowInstance}
        onNodeClick={(_, node) => {
          if (selectionLockRef.current) {
            return;
          }

          onSelectNode(node.id);
        }}
        onEdgeClick={() => {
          if (selectionLockRef.current) {
            return;
          }

          onSelectNode(null);
        }}
        onPaneClick={() => {
          if (selectionLockRef.current) {
            return;
          }

          onSelectNode(null);
        }}
        onConnect={handleConnect}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        defaultEdgeOptions={defaultEdgeStyle}
        deleteKeyCode={['Delete', 'Backspace']}
        snapToGrid
        snapGrid={[16, 16]}
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={24} size={1.2} color="#d7dfeb" />
      </ReactFlow>
    </div>
  );
}
