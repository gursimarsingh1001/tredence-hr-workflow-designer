import { describe, expect, it } from 'vitest';

import { NodeType, type WorkflowEdge, type WorkflowNode } from '../types';
import {
  buildAutoOrderedWorkflow,
  buildAutoOrderedWorkflowGroup,
  filterMeaningfulEdgeChanges,
  filterMeaningfulNodeChanges,
  mergeRenderPreviewNodes,
  canUseAutoOrderedInsertion,
  filterGroupDragNodeChanges,
  moveWorkflowGroup,
  shouldDetachNodeFromWorkflowGroup,
} from './WorkflowCanvas';

function createNode(id: string, type: NodeType, x = 0): WorkflowNode {
  return {
    id,
    type,
    position: { x, y: 180 },
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
                title: 'Task',
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
                  title: 'Approval',
                  approverRole: 'Manager',
                  autoApproveThreshold: 0,
                },
              }
            : type === NodeType.AUTOMATED_STEP
              ? {
                  nodeType: NodeType.AUTOMATED_STEP,
                  config: {
                    title: 'Automated Step',
                    actionId: 'send_email',
                    parameters: {
                      to: 'hr@example.com',
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

function getChangeIdentifier(change: { type: string } & Record<string, unknown>) {
  return typeof change.id === 'string' ? change.id : change.type;
}

describe('WorkflowCanvas auto ordering helpers', () => {
  it('inserts a missing task into the second slot of a simple linear flow', () => {
    const nodes = [
      createNode('start', NodeType.START, 80),
      createNode('approval', NodeType.APPROVAL, 320),
      createNode('auto', NodeType.AUTOMATED_STEP, 560),
    ];
    const edges = [
      createEdge('edge-1', 'start', 'approval'),
      createEdge('edge-2', 'approval', 'auto'),
    ];

    expect(canUseAutoOrderedInsertion(nodes, edges, NodeType.TASK)).toBe(true);

    const workflow = buildAutoOrderedWorkflow(
      nodes,
      createNode('task', NodeType.TASK, 800),
      180,
    );

    expect(workflow.nodes.map((node) => node.id)).toEqual(['start', 'task', 'approval', 'auto']);
    expect(workflow.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ['start', 'task'],
      ['task', 'approval'],
      ['approval', 'auto'],
    ]);
    expect(workflow.nodes.map((node) => node.position.x)).toEqual([80, 372, 664, 956]);
  });

  it('does not auto-order branched workflows', () => {
    const nodes = [
      createNode('start', NodeType.START, 80),
      createNode('task', NodeType.TASK, 320),
      createNode('approval', NodeType.APPROVAL, 560),
      createNode('end', NodeType.END, 800),
    ];
    const edges = [
      createEdge('edge-1', 'start', 'task'),
      createEdge('edge-2', 'start', 'approval'),
      createEdge('edge-3', 'approval', 'end'),
    ];

    expect(canUseAutoOrderedInsertion(nodes, edges, NodeType.AUTOMATED_STEP)).toBe(false);
  });

  it('reorders only the selected workflow group when a missing task is added late', () => {
    const nodes = [
      createNode('start-1', NodeType.START, 80),
      createNode('approval-1', NodeType.APPROVAL, 320),
      createNode('auto-1', NodeType.AUTOMATED_STEP, 560),
      createNode('start-2', NodeType.START, 80),
      createNode('task-2', NodeType.TASK, 320),
      createNode('end-2', NodeType.END, 560),
    ];
    nodes[3].position.y = 420;
    nodes[4].position.y = 420;
    nodes[5].position.y = 420;

    const edges = [
      createEdge('edge-1', 'start-1', 'approval-1'),
      createEdge('edge-2', 'approval-1', 'auto-1'),
      createEdge('edge-3', 'start-2', 'task-2'),
      createEdge('edge-4', 'task-2', 'end-2'),
    ];

    const nextWorkflow = buildAutoOrderedWorkflowGroup(
      nodes,
      edges,
      'auto-1',
      createNode('task-1', NodeType.TASK, 800),
      180,
    );

    expect(nextWorkflow).not.toBeNull();
    expect(
      nextWorkflow?.edges
        .filter((edge) => ['start-1', 'task-1', 'approval-1', 'auto-1'].includes(edge.source))
        .map((edge) => [edge.source, edge.target]),
    ).toEqual([
      ['start-1', 'task-1'],
      ['task-1', 'approval-1'],
      ['approval-1', 'auto-1'],
    ]);
    expect(
      nextWorkflow?.edges
        .filter((edge) => ['start-2', 'task-2', 'end-2'].includes(edge.source))
        .map((edge) => [edge.source, edge.target]),
    ).toEqual([
      ['start-2', 'task-2'],
      ['task-2', 'end-2'],
    ]);
  });

  it('moves an entire connected workflow group when its start node is dragged', () => {
    const nodes = [
      createNode('start', NodeType.START, 80),
      createNode('task', NodeType.TASK, 372),
      createNode('approval', NodeType.APPROVAL, 664),
      createNode('start-2', NodeType.START, 80),
    ];
    nodes[3].position.y = 420;

    const movedWorkflow = moveWorkflowGroup(
      nodes,
      new Set(['start', 'task', 'approval']),
      {
        start: { x: 80, y: 180 },
        task: { x: 372, y: 180 },
        approval: { x: 664, y: 180 },
      },
      { x: 0, y: -120 },
    );

    expect(movedWorkflow).not.toBeNull();
    expect(
      movedWorkflow?.nodes
        .filter((node) => ['start', 'task', 'approval'].includes(node.id))
        .map((node) => node.position.y),
    ).toEqual([60, 60, 60]);
    expect(
      movedWorkflow?.nodes.find((node) => node.id === 'start-2')?.position.y,
    ).toBe(420);
  });

  it('moves a single disconnected node without dropping the update', () => {
    const nodes = [
      createNode('start', NodeType.START, 80),
      createNode('approval', NodeType.APPROVAL, 664),
    ];
    nodes[1].position.y = 420;

    const movedWorkflow = moveWorkflowGroup(
      nodes,
      new Set(['approval']),
      {
        approval: { x: 664, y: 420 },
      },
      { x: 0, y: -80 },
    );

    expect(movedWorkflow).not.toBeNull();
    expect(movedWorkflow?.nodes.find((node) => node.id === 'approval')?.position.y).toBe(340);
  });

  it('detaches duplicate node types from the current workflow group', () => {
    const nodes = [
      createNode('start', NodeType.START, 80),
      createNode('task', NodeType.TASK, 372),
      createNode('approval', NodeType.APPROVAL, 664),
    ];
    const edges = [
      createEdge('edge-1', 'start', 'task'),
      createEdge('edge-2', 'task', 'approval'),
    ];

    expect(
      shouldDetachNodeFromWorkflowGroup(nodes, edges, 'approval', NodeType.APPROVAL),
    ).toBe(true);
    expect(
      shouldDetachNodeFromWorkflowGroup(nodes, edges, 'approval', NodeType.END),
    ).toBe(false);
  });

  it('filters dragged group position changes during and right after group drag', () => {
    const changes = [
      {
        id: 'task',
        type: 'position' as const,
        position: { x: 320, y: 240 },
        dragging: false,
      },
      {
        id: 'approval',
        type: 'dimensions' as const,
        dimensions: { width: 200, height: 120 },
      },
      {
        id: 'start-2',
        type: 'position' as const,
        position: { x: 80, y: 420 },
        dragging: false,
      },
    ];

    expect(
      filterGroupDragNodeChanges(changes, new Set(['task', 'approval']), null).map(
        (change) => getChangeIdentifier(change),
      ),
    ).toEqual(['approval', 'start-2']);

    expect(
      filterGroupDragNodeChanges(changes, null, new Set(['task'])).map((change) =>
        getChangeIdentifier(change),
      ),
    ).toEqual(['approval', 'start-2']);
  });

  it('ignores non-meaningful node changes so selection noise does not pollute undo history', () => {
    const changes = [
      {
        id: 'task',
        type: 'select' as const,
        selected: true,
      },
      {
        id: 'task',
        type: 'dimensions' as const,
        dimensions: { width: 220, height: 120 },
      },
      {
        id: 'task',
        type: 'position' as const,
        position: { x: 320, y: 240 },
        dragging: false,
      },
      {
        id: 'approval',
        type: 'remove' as const,
      },
    ];

    expect(filterMeaningfulNodeChanges(changes).map((change) => getChangeIdentifier(change))).toEqual([
      'task',
      'approval',
    ]);
  });

  it('ignores non-meaningful edge changes so edge selection does not consume undo steps', () => {
    const changes = [
      {
        id: 'edge-1',
        type: 'select' as const,
        selected: true,
      },
      {
        id: 'edge-2',
        type: 'remove' as const,
      },
    ];

    expect(filterMeaningfulEdgeChanges(changes).map((change) => getChangeIdentifier(change))).toEqual([
      'edge-2',
    ]);
  });

  it('reuses render node UI state while applying drag preview positions locally', () => {
    const unchangedNode = createNode('start', NodeType.START, 80);
    const renderNodes = [
      unchangedNode,
      {
        ...createNode('task', NodeType.TASK, 372),
        data: {
          ...createNode('task', NodeType.TASK, 372).data,
          ui: {
            collapsed: true,
            errors: ['Assignee required'],
            isInvalid: true,
          },
        },
      },
    ];
    const previewNodes = [
      unchangedNode,
      {
        ...createNode('task', NodeType.TASK, 372),
        position: { x: 372, y: 60 },
      },
    ];

    const mergedNodes = mergeRenderPreviewNodes(renderNodes, previewNodes);

    expect(mergedNodes[0]).toBe(unchangedNode);
    expect(mergedNodes[1]?.position).toEqual({ x: 372, y: 60 });
    expect(mergedNodes[1]?.data.ui?.collapsed).toBe(true);
    expect(mergedNodes[1]?.data.ui?.errors).toEqual(['Assignee required']);
  });

  it('does not override the actively dragged node with preview state', () => {
    const renderNodes = [
      createNode('task', NodeType.TASK, 372),
      createNode('approval', NodeType.APPROVAL, 664),
    ];
    const previewNodes = [
      {
        ...createNode('task', NodeType.TASK, 372),
        position: { x: 420, y: 120 },
      },
      {
        ...createNode('approval', NodeType.APPROVAL, 664),
        position: { x: 664, y: 120 },
      },
    ];

    const mergedNodes = mergeRenderPreviewNodes(renderNodes, previewNodes, 'task');

    expect(mergedNodes[0]).toBe(renderNodes[0]);
    expect(mergedNodes[0]?.position).toEqual({ x: 372, y: 180 });
    expect(mergedNodes[1]?.position).toEqual({ x: 664, y: 120 });
  });
});
