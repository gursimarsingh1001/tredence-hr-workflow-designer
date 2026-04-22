import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTemplateWorkflow } from '../App';
import { NodeType, type SimulationRequest, type WorkflowEdge, type WorkflowNode } from '../types';
import { getAutomations, simulateWorkflow } from './mockApi';

function createNode(
  id: string,
  type: NodeType,
): WorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 120 },
    data:
      type === NodeType.START
        ? {
            nodeType: NodeType.START,
            config: { title: 'Start workflow', metadata: {} },
          }
        : type === NodeType.TASK
          ? {
              nodeType: NodeType.TASK,
              config: {
                title: id === 'task-a' ? 'Collect Forms' : 'Manager Review',
                description: '',
                assignee: 'HR',
                dueDate: '',
                customFields: {},
              },
            }
          : type === NodeType.END
            ? {
                nodeType: NodeType.END,
                config: { endMessage: `${id} complete`, summaryFlag: true },
              }
            : {
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

afterEach(() => {
  vi.useRealTimers();
});

describe('mockApi', () => {
  it('returns the required automation actions including email body', async () => {
    vi.useFakeTimers();

    const automationsPromise = getAutomations();
    await vi.advanceTimersByTimeAsync(300);
    const automations = await automationsPromise;

    expect(automations).toEqual([
      {
        id: 'send_email',
        label: 'Send Email',
        params: ['to', 'subject', 'body'],
      },
      {
        id: 'generate_doc',
        label: 'Generate Document',
        params: ['template', 'recipient'],
      },
    ]);
  });

  it('simulates deterministic DFS traversal using edge order', async () => {
    vi.useFakeTimers();

    const request: SimulationRequest = {
      workflow: {
        nodes: [
          createNode('start', NodeType.START),
          createNode('task-a', NodeType.TASK),
          createNode('task-b', NodeType.TASK),
          createNode('end-a', NodeType.END),
          createNode('end-b', NodeType.END),
        ],
        edges: [
          createEdge('e1', 'start', 'task-a'),
          createEdge('e2', 'start', 'task-b'),
          createEdge('e3', 'task-a', 'end-a'),
          createEdge('e4', 'task-b', 'end-b'),
        ],
      },
    };

    const resultPromise = simulateWorkflow(request);
    await vi.advanceTimersByTimeAsync(1200);
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.steps.map((step) => step.nodeId)).toEqual([
      'start',
      'task-a',
      'end-a',
      'task-b',
      'end-b',
    ]);
    expect(result.steps.every((step) => step.status === 'completed')).toBe(true);
    expect(result.totalDuration).toBe(result.steps.length * 200);
    expect(result.steps[0]?.timestamp).toBe('2026-01-01T09:00:00.200Z');
    expect(result.steps[4]?.timestamp).toBe('2026-01-01T09:00:01.000Z');
  });

  it('simulates the document verification template with generate_doc and an empty task due date', async () => {
    vi.useFakeTimers();

    const request: SimulationRequest = {
      workflow: createTemplateWorkflow('document_verification'),
    };

    const resultPromise = simulateWorkflow(request);
    await vi.advanceTimersByTimeAsync(1200);
    const result = await resultPromise;

    const taskNode = request.workflow.nodes.find((node) => node.id === 'doc-task');
    const automationStep = result.steps.find((step) => step.nodeId === 'doc-auto');

    expect(taskNode?.type).toBe(NodeType.TASK);
    expect(taskNode?.data.nodeType).toBe(NodeType.TASK);
    expect(taskNode?.data.nodeType === NodeType.TASK ? taskNode.data.config.dueDate : undefined).toBe('');
    expect(result.success).toBe(true);
    expect(automationStep?.action).toContain('Generate Document');
  });
});
