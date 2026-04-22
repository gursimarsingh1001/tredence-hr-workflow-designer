import { describe, expect, it } from 'vitest';

import { NodeType, type ApprovalData, type WorkflowEdge, type WorkflowNode } from '../types';
import { groupValidationErrorsByNode, validateWorkflow } from './validators';

function createNode(
  id: string,
  type: NodeType,
  overrides: Partial<WorkflowNode> = {},
): WorkflowNode {
  const baseNode: WorkflowNode = {
    id,
    type,
    position: { x: 0, y: 0 },
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

  return {
    ...baseNode,
    ...overrides,
  };
}

function createEdge(id: string, source: string, target: string): WorkflowEdge {
  return {
    id,
    source,
    target,
  };
}

function createValidWorkflow() {
  const nodes = [
    createNode('start', NodeType.START),
    createNode('task', NodeType.TASK),
    createNode('approval', NodeType.APPROVAL),
    createNode('auto', NodeType.AUTOMATED_STEP),
    createNode('end', NodeType.END),
  ];

  const edges = [
    createEdge('e1', 'start', 'task'),
    createEdge('e2', 'task', 'approval'),
    createEdge('e3', 'approval', 'auto'),
    createEdge('e4', 'auto', 'end'),
  ];

  return { nodes, edges };
}

describe('validateWorkflow', () => {
  it('accepts a valid workflow', () => {
    const { nodes, edges } = createValidWorkflow();

    const result = validateWorkflow(nodes, edges);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a linear approval step without explicit approved/rejected routing', () => {
    const { nodes, edges } = createValidWorkflow();

    const approvalOutgoingEdges = edges.filter((edge) => edge.source === 'approval');
    const result = validateWorkflow(nodes, edges);

    expect(approvalOutgoingEdges).toHaveLength(1);
    expect(approvalOutgoingEdges[0]?.target).toBe('auto');
    expect(result.isValid).toBe(true);
  });

  it('allows multiple Start nodes for independent workflow groups', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes.push(createNode('start-2', NodeType.START));
    nodes.push(createNode('task-2', NodeType.TASK));
    nodes.push(createNode('end-2', NodeType.END));
    edges.push(createEdge('e5', 'start-2', 'task-2'));
    edges.push(createEdge('e6', 'task-2', 'end-2'));

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Only one Start allowed')).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('flags when there is no End node', () => {
    const { nodes, edges } = createValidWorkflow();

    const result = validateWorkflow(
      nodes.filter((node) => node.type !== NodeType.END),
      edges.filter((edge) => edge.target !== 'end' && edge.source !== 'end'),
    );

    expect(result.errors.some((error) => error.message === 'Must have at least 1 End node')).toBe(true);
  });

  it('flags an incoming edge to Start', () => {
    const { nodes, edges } = createValidWorkflow();
    edges.push(createEdge('e5', 'end', 'start'));

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Incoming edge not allowed')).toBe(true);
  });

  it('flags disconnected subgraphs', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes.push(createNode('side-task', NodeType.TASK));
    nodes.push(createNode('side-end', NodeType.END));
    edges.push(createEdge('e5', 'side-task', 'side-end'));

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Disconnected')).toBe(true);
  });

  it('flags cycles', () => {
    const { nodes, edges } = createValidWorkflow();
    edges.push(createEdge('e5', 'approval', 'task'));

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Cycle detected')).toBe(true);
  });

  it('flags empty Task title', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[1] = createNode('task', NodeType.TASK, {
      data: {
        nodeType: NodeType.TASK,
        config: {
          title: '',
          description: '',
          assignee: 'HR Admin',
          dueDate: '',
          customFields: {},
        },
      },
    });

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Title required')).toBe(true);
  });

  it('flags empty Task assignee', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[1] = createNode('task', NodeType.TASK, {
      data: {
        nodeType: NodeType.TASK,
        config: {
          title: 'Review Task',
          description: '',
          assignee: '',
          dueDate: '',
          customFields: {},
        },
      },
    });

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Assignee required')).toBe(true);
  });

  it('treats an empty due date as a valid optional Task field in the MVP', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[1] = createNode('task', NodeType.TASK, {
      data: {
        nodeType: NodeType.TASK,
        config: {
          title: 'Review Task',
          description: '',
          assignee: 'HR Admin',
          dueDate: '',
          customFields: {},
        },
      },
    });

    const result = validateWorkflow(nodes, edges);

    expect(result.isValid).toBe(true);
    expect(result.errors.some((error) => error.nodeId === 'task' && error.shortMessage?.includes('Due'))).toBe(false);
  });

  it('flags empty Approval title', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[2] = createNode('approval', NodeType.APPROVAL, {
      data: {
        nodeType: NodeType.APPROVAL,
        config: {
          title: '',
          approverRole: 'Manager',
          autoApproveThreshold: 0,
        },
      },
    });

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Title required')).toBe(true);
  });

  it('flags empty Approval approverRole', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[2] = createNode('approval', NodeType.APPROVAL, {
      data: {
        nodeType: NodeType.APPROVAL,
        config: {
          title: 'Manager Approval',
          approverRole: '' as unknown as ApprovalData['approverRole'],
          autoApproveThreshold: 0,
        },
      },
    });

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Approver role required')).toBe(true);
  });

  it('flags empty Automated Step title', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[3] = createNode('auto', NodeType.AUTOMATED_STEP, {
      data: {
        nodeType: NodeType.AUTOMATED_STEP,
        config: {
          title: '',
          actionId: 'send_email',
          parameters: {
            to: 'person@example.com',
            subject: 'Ready',
            body: 'Done',
          },
        },
      },
    });

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Title required')).toBe(true);
  });

  it('flags empty Automated Step action', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[3] = createNode('auto', NodeType.AUTOMATED_STEP, {
      data: {
        nodeType: NodeType.AUTOMATED_STEP,
        config: {
          title: 'Send Email',
          actionId: '',
          parameters: {},
        },
      },
    });

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'Action required')).toBe(true);
  });

  it('flags empty End message', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[4] = createNode('end', NodeType.END, {
      data: {
        nodeType: NodeType.END,
        config: {
          endMessage: '',
          summaryFlag: true,
        },
      },
    });

    const result = validateWorkflow(nodes, edges);

    expect(result.errors.some((error) => error.shortMessage === 'End message required')).toBe(true);
  });

  it('groups node errors into short labels for canvas highlighting', () => {
    const { nodes, edges } = createValidWorkflow();
    nodes[1] = createNode('task', NodeType.TASK, {
      data: {
        nodeType: NodeType.TASK,
        config: {
          title: '',
          description: '',
          assignee: '',
          dueDate: '',
          customFields: {},
        },
      },
    });

    const result = validateWorkflow(nodes, edges);
    const groupedErrors = groupValidationErrorsByNode(result.errors);

    expect(groupedErrors.task).toContain('Title required');
    expect(groupedErrors.task).toContain('Assignee required');
  });
});
