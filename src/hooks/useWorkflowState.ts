import { useCallback, useMemo, useReducer } from 'react';
import {
  applyEdgeChanges as applyReactFlowEdgeChanges,
  applyNodeChanges as applyReactFlowNodeChanges,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';

import type {
  NodeData,
  NodeVersionEntry,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowState,
} from '../types';

type Action =
  | { type: 'ADD_NODE'; payload: { node: WorkflowNode; edge?: WorkflowEdge | null } }
  | { type: 'UPDATE_NODE'; payload: { id: string; data: NodeData } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'ADD_EDGE'; payload: WorkflowEdge }
  | { type: 'DELETE_EDGE'; payload: string }
  | { type: 'APPLY_NODE_CHANGES'; payload: NodeChange<WorkflowNode>[] }
  | { type: 'APPLY_EDGE_CHANGES'; payload: EdgeChange<WorkflowEdge>[] }
  | {
      type: 'REPLACE_WORKFLOW';
      payload: {
        workflow: WorkflowDefinition;
        label: string;
        preserveHistory?: boolean;
        recordHistory?: boolean;
        preserveSelection?: boolean;
        historyBase?: WorkflowState;
      };
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR' };

export interface WorkflowHistoryState {
  past: WorkflowState[];
  present: WorkflowState;
  future: WorkflowState[];
}

const MAX_HISTORY_ENTRIES = 40;
const MAX_NODE_VERSIONS = 8;

const initialWorkflowState: WorkflowState = {
  nodes: [],
  edges: [],
  nodeHistory: {},
  selectedNodeId: null,
};

export const initialWorkflowHistoryState: WorkflowHistoryState = {
  past: [],
  present: initialWorkflowState,
  future: [],
};

function cloneState<T>(value: T): T {
  return structuredClone(value);
}

function getSyncedSelection(nodes: WorkflowNode[], selectedNodeId: string | null) {
  if (!selectedNodeId) {
    return null;
  }

  return nodes.some((node) => node.id === selectedNodeId) ? selectedNodeId : null;
}

function createNodeVersionEntry(node: WorkflowNode, label: string): NodeVersionEntry {
  return {
    id: `${node.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    label,
    data: cloneState(node.data),
  };
}

function createNodeHistory(nodes: WorkflowNode[], label: string) {
  return Object.fromEntries(nodes.map((node) => [node.id, [createNodeVersionEntry(node, label)]]));
}

function syncNodeHistory(
  nodes: WorkflowNode[],
  nodeHistory: Record<string, NodeVersionEntry[]>,
) {
  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      nodeHistory[node.id] ?? [createNodeVersionEntry(node, 'Imported')],
    ]),
  );
}

function areWorkflowStatesEqual(a: WorkflowState, b: WorkflowState) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function commitState(
  store: WorkflowHistoryState,
  nextPresent: WorkflowState,
  recordHistory: boolean,
  historyBase?: WorkflowState,
): WorkflowHistoryState {
  if (!recordHistory) {
    if (areWorkflowStatesEqual(store.present, nextPresent)) {
      return store;
    }

    return {
      ...store,
      present: nextPresent,
    };
  }

  const previousForHistory = historyBase ?? store.present;

  if (areWorkflowStatesEqual(previousForHistory, nextPresent)) {
    if (historyBase && !areWorkflowStatesEqual(store.present, nextPresent)) {
      return {
        ...store,
        present: nextPresent,
      };
    }

    return store;
  }

  return {
    past: [...store.past, cloneState(previousForHistory)].slice(-MAX_HISTORY_ENTRIES),
    present: nextPresent,
    future: [],
  };
}

function preserveSelectionIfRequested(
  nextNodes: WorkflowNode[],
  state: WorkflowState,
  preserveSelection?: boolean,
) {
  if (!preserveSelection) {
    return null;
  }

  return getSyncedSelection(nextNodes, state.selectedNodeId);
}

export function workflowHistoryReducer(
  store: WorkflowHistoryState,
  action: Action,
): WorkflowHistoryState {
  const state = store.present;

  switch (action.type) {
    case 'ADD_NODE': {
      const nextPresent: WorkflowState = {
        ...state,
        nodes: [...state.nodes, action.payload.node],
        edges: action.payload.edge ? [...state.edges, action.payload.edge] : state.edges,
        nodeHistory: {
          ...state.nodeHistory,
          [action.payload.node.id]: [createNodeVersionEntry(action.payload.node, 'Created')],
        },
      };

      return commitState(store, nextPresent, true);
    }

    case 'UPDATE_NODE': {
      const currentNode = state.nodes.find((node) => node.id === action.payload.id);
      if (!currentNode || JSON.stringify(currentNode.data) === JSON.stringify(action.payload.data)) {
        return store;
      }

      const updatedNode = {
        ...currentNode,
        data: action.payload.data,
      };

      const nextHistory = [
        ...(state.nodeHistory[action.payload.id] ?? []),
        createNodeVersionEntry(updatedNode, 'Edited'),
      ].slice(-MAX_NODE_VERSIONS);

      const nextPresent: WorkflowState = {
        ...state,
        nodes: state.nodes.map((node) => (node.id === action.payload.id ? updatedNode : node)),
        nodeHistory: {
          ...state.nodeHistory,
          [action.payload.id]: nextHistory,
        },
      };

      return commitState(store, nextPresent, true);
    }

    case 'DELETE_NODE': {
      const nodes = state.nodes.filter((node) => node.id !== action.payload);
      const edges = state.edges.filter(
        (edge) => edge.source !== action.payload && edge.target !== action.payload,
      );
      const { [action.payload]: _deletedNodeHistory, ...remainingHistory } = state.nodeHistory;

      const nextPresent: WorkflowState = {
        ...state,
        nodes,
        edges,
        nodeHistory: remainingHistory,
        selectedNodeId: getSyncedSelection(nodes, state.selectedNodeId),
      };

      return commitState(store, nextPresent, true);
    }

    case 'SELECT_NODE':
      if (state.selectedNodeId === action.payload) {
        return store;
      }

      return {
        ...store,
        present: {
          ...state,
          selectedNodeId: action.payload,
        },
      };

    case 'ADD_EDGE':
      return commitState(
        store,
        {
          ...state,
          edges: [...state.edges, action.payload],
        },
        true,
      );

    case 'DELETE_EDGE':
      return commitState(
        store,
        {
          ...state,
          edges: state.edges.filter((edge) => edge.id !== action.payload),
        },
        true,
      );

    case 'APPLY_NODE_CHANGES': {
      const nodes = applyReactFlowNodeChanges(action.payload, state.nodes);

      return commitState(
        store,
        {
          ...state,
          nodes,
          nodeHistory: syncNodeHistory(nodes, state.nodeHistory),
          selectedNodeId: getSyncedSelection(nodes, state.selectedNodeId),
        },
        true,
      );
    }

    case 'APPLY_EDGE_CHANGES':
      return commitState(
        store,
        {
          ...state,
          edges: applyReactFlowEdgeChanges(action.payload, state.edges),
        },
        true,
      );

    case 'REPLACE_WORKFLOW': {
      const nextNodes = action.payload.workflow.nodes;
      const nextPresent: WorkflowState = {
        nodes: nextNodes,
        edges: action.payload.workflow.edges,
        nodeHistory: action.payload.preserveHistory
          ? syncNodeHistory(nextNodes, state.nodeHistory)
          : createNodeHistory(nextNodes, action.payload.label),
        selectedNodeId: preserveSelectionIfRequested(
          nextNodes,
          state,
          action.payload.preserveSelection,
        ),
      };

      return commitState(
        store,
        nextPresent,
        action.payload.recordHistory ?? true,
        action.payload.historyBase,
      );
    }

    case 'UNDO': {
      if (store.past.length === 0) {
        return store;
      }

      const previousState = cloneState(store.past[store.past.length - 1]);
      return {
        past: store.past.slice(0, -1),
        present: previousState,
        future: [cloneState(store.present), ...store.future],
      };
    }

    case 'REDO': {
      if (store.future.length === 0) {
        return store;
      }

      const [nextState, ...remainingFuture] = store.future;
      return {
        past: [...store.past, cloneState(store.present)].slice(-MAX_HISTORY_ENTRIES),
        present: cloneState(nextState),
        future: remainingFuture,
      };
    }

    case 'CLEAR':
      return commitState(store, initialWorkflowState, true);

    default:
      return store;
  }
}

export function useWorkflowState() {
  const [store, dispatch] = useReducer(workflowHistoryReducer, initialWorkflowHistoryState);
  const state = store.present;

  const addNode = useCallback((node: WorkflowNode, edge?: WorkflowEdge | null) => {
    dispatch({ type: 'ADD_NODE', payload: { node, edge: edge ?? null } });
    return node.id;
  }, []);

  const updateNode = useCallback((id: string, data: NodeData) => {
    dispatch({ type: 'UPDATE_NODE', payload: { id, data } });
  }, []);

  const deleteNode = useCallback((id: string) => {
    dispatch({ type: 'DELETE_NODE', payload: id });
  }, []);

  const selectNode = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_NODE', payload: id });
  }, []);

  const addEdge = useCallback((edge: WorkflowEdge) => {
    dispatch({ type: 'ADD_EDGE', payload: edge });
  }, []);

  const deleteEdge = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EDGE', payload: id });
  }, []);

  const applyWorkflowNodeChanges = useCallback((changes: NodeChange<WorkflowNode>[]) => {
    dispatch({ type: 'APPLY_NODE_CHANGES', payload: changes });
  }, []);

  const applyWorkflowEdgeChanges = useCallback((changes: EdgeChange<WorkflowEdge>[]) => {
    dispatch({ type: 'APPLY_EDGE_CHANGES', payload: changes });
  }, []);

  const replaceWorkflow = useCallback((
    workflow: WorkflowDefinition,
    label = 'Imported workflow',
    preserveHistory = false,
    recordHistory = true,
    preserveSelection = false,
    historyBase?: WorkflowState,
  ) => {
    dispatch({
      type: 'REPLACE_WORKFLOW',
      payload: {
        workflow,
        label,
        preserveHistory,
        recordHistory,
        preserveSelection,
        historyBase,
      },
    });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const clearWorkflow = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const selectedNode = state.selectedNodeId
    ? state.nodes.find((node) => node.id === state.selectedNodeId) ?? null
    : null;

  const selectedNodeHistory = selectedNode ? state.nodeHistory[selectedNode.id] ?? [] : [];

  const actions = useMemo(
    () => ({
      addNode,
      updateNode,
      deleteNode,
      selectNode,
      addEdge,
      deleteEdge,
      applyNodeChanges: applyWorkflowNodeChanges,
      applyEdgeChanges: applyWorkflowEdgeChanges,
      replaceWorkflow,
      undo,
      redo,
      clearWorkflow,
    }),
    [
      addNode,
      updateNode,
      deleteNode,
      selectNode,
      addEdge,
      deleteEdge,
      applyWorkflowNodeChanges,
      applyWorkflowEdgeChanges,
      replaceWorkflow,
      undo,
      redo,
      clearWorkflow,
    ],
  );

  return {
    state,
    selectedNode,
    selectedNodeHistory,
    canUndo: store.past.length > 0,
    canRedo: store.future.length > 0,
    actions,
  };
}
