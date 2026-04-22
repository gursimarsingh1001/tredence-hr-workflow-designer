import { describe, expect, it } from 'vitest';

import { NodeType, type WorkflowEdge, type WorkflowNode } from '../types';
import { initialWorkflowHistoryState, workflowHistoryReducer } from './useWorkflowState';

function createNode(id: string, type: NodeType): WorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 120 },
    data:
      type === NodeType.START
        ? {
            nodeType: NodeType.START,
            config: {
              title: 'Workflow Start',
              metadata: {},
            },
          }
        : type === NodeType.TASK
          ? {
              nodeType: NodeType.TASK,
              config: {
                title: 'Review Task',
                description: '',
                assignee: 'HR Admin',
                dueDate: '',
                customFields: {},
              },
            }
          : type === NodeType.APPROVAL
            ? {
                nodeType: NodeType.APPROVAL,
                config: {
                  title: 'Manager Approval',
                  approverRole: 'Manager',
                  autoApproveThreshold: 0,
                },
              }
            : type === NodeType.AUTOMATED_STEP
              ? {
                  nodeType: NodeType.AUTOMATED_STEP,
                  config: {
                    title: 'Send Email',
                    actionId: 'send_email',
                    parameters: {
                      to: 'person@example.com',
                      subject: 'Ready',
                      body: 'Done',
                    },
                  },
                }
              : {
                  nodeType: NodeType.END,
                  config: {
                    endMessage: 'Workflow complete',
                    summaryFlag: true,
                  },
                },
  };
}

function createEdge(id: string, source: string, target: string): WorkflowEdge {
  return {
    id,
    source,
    target,
  };
}

describe('workflowHistoryReducer', () => {
  it('undoes a dropped node and its auto-connected edge in one step', () => {
    const startNode = createNode('start', NodeType.START);
    const taskNode = createNode('task', NodeType.TASK);
    const taskEdge = createEdge('edge-1', 'start', 'task');

    let state = structuredClone(initialWorkflowHistoryState);
    state = workflowHistoryReducer(state, {
      type: 'ADD_NODE',
      payload: { node: startNode },
    });
    state = workflowHistoryReducer(state, {
      type: 'ADD_NODE',
      payload: { node: taskNode, edge: taskEdge },
    });

    expect(state.present.nodes.map((node) => node.id)).toEqual(['start', 'task']);
    expect(state.present.edges.map((edge) => edge.id)).toEqual(['edge-1']);

    state = workflowHistoryReducer(state, { type: 'UNDO' });

    expect(state.present.nodes.map((node) => node.id)).toEqual(['start']);
    expect(state.present.edges).toHaveLength(0);
  });

  it('deletes only the selected node data instead of clearing the whole workflow', () => {
    const startNode = createNode('start', NodeType.START);
    const taskNode = createNode('task', NodeType.TASK);
    const endNode = createNode('end', NodeType.END);

    let state = structuredClone(initialWorkflowHistoryState);
    state = workflowHistoryReducer(state, {
      type: 'REPLACE_WORKFLOW',
      payload: {
        label: 'Loaded',
        workflow: {
          nodes: [startNode, taskNode, endNode],
          edges: [
            createEdge('edge-1', 'start', 'task'),
            createEdge('edge-2', 'task', 'end'),
          ],
        },
      },
    });
    state = workflowHistoryReducer(state, { type: 'SELECT_NODE', payload: 'task' });
    state = workflowHistoryReducer(state, { type: 'DELETE_NODE', payload: 'task' });

    expect(state.present.nodes.map((node) => node.id)).toEqual(['start', 'end']);
    expect(state.present.edges).toHaveLength(0);
  });

  it('does not create an undo step for transient workflow replacement updates', () => {
    const startNode = createNode('start', NodeType.START);
    const taskNode = createNode('task', NodeType.TASK);

    let state = structuredClone(initialWorkflowHistoryState);
    state = workflowHistoryReducer(state, {
      type: 'REPLACE_WORKFLOW',
      payload: {
        label: 'Loaded',
        workflow: {
          nodes: [startNode, taskNode],
          edges: [createEdge('edge-1', 'start', 'task')],
        },
      },
    });

    const movedTask = {
      ...taskNode,
      position: { x: 280, y: 120 },
    };

    state = workflowHistoryReducer(state, {
      type: 'REPLACE_WORKFLOW',
      payload: {
        label: 'Moving workflow group',
        preserveHistory: true,
        recordHistory: false,
        workflow: {
          nodes: [startNode, movedTask],
          edges: [createEdge('edge-1', 'start', 'task')],
        },
      },
    });

    expect(state.past).toHaveLength(1);
    expect(state.present.nodes.find((node) => node.id === 'task')?.position.x).toBe(280);

    state = workflowHistoryReducer(state, { type: 'UNDO' });

    expect(state.present.nodes).toHaveLength(0);
  });

  it('preserves selection and records drag history from the original snapshot on drop', () => {
    const startNode = createNode('start', NodeType.START);
    const taskNode = createNode('task', NodeType.TASK);
    const loadedWorkflow = {
      nodes: [startNode, taskNode],
      edges: [createEdge('edge-1', 'start', 'task')],
    };

    let state = structuredClone(initialWorkflowHistoryState);
    state = workflowHistoryReducer(state, {
      type: 'REPLACE_WORKFLOW',
      payload: {
        label: 'Loaded',
        workflow: loadedWorkflow,
      },
    });
    state = workflowHistoryReducer(state, { type: 'SELECT_NODE', payload: 'task' });

    const dragStartSnapshot = structuredClone(state.present);
    const movedTask = {
      ...taskNode,
      position: { x: 280, y: 120 },
    };

    state = workflowHistoryReducer(state, {
      type: 'REPLACE_WORKFLOW',
      payload: {
        label: 'Moving workflow group',
        preserveHistory: true,
        preserveSelection: true,
        recordHistory: false,
        workflow: {
          nodes: [startNode, movedTask],
          edges: [createEdge('edge-1', 'start', 'task')],
        },
      },
    });

    expect(state.present.selectedNodeId).toBe('task');
    expect(state.past).toHaveLength(1);

    state = workflowHistoryReducer(state, {
      type: 'REPLACE_WORKFLOW',
      payload: {
        label: 'Moved workflow group',
        preserveHistory: true,
        preserveSelection: true,
        recordHistory: true,
        historyBase: dragStartSnapshot,
        workflow: {
          nodes: [startNode, movedTask],
          edges: [createEdge('edge-1', 'start', 'task')],
        },
      },
    });

    expect(state.past).toHaveLength(2);

    state = workflowHistoryReducer(state, { type: 'UNDO' });

    expect(state.present.nodes.find((node) => node.id === 'task')?.position.x).toBe(0);
    expect(state.present.selectedNodeId).toBe('task');
  });
});
