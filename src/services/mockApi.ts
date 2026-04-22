import type {
  AutomationAction,
  SimulationRequest,
  SimulationResult,
  SimulationStep,
  WorkflowNode,
} from '../types';
import { NodeType } from '../types';

// The MVP intentionally keeps the automation contract narrow:
// only send_email and generate_doc are supported by the local mock API.
const MOCK_AUTOMATIONS: AutomationAction[] = [
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
];

const DETERMINISTIC_START_TIME = Date.parse('2026-01-01T09:00:00.000Z');

export async function getAutomations(): Promise<AutomationAction[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return MOCK_AUTOMATIONS.map((action) => ({ ...action, params: [...action.params] }));
}

function getNodeLabel(node: WorkflowNode, automationsById: Map<string, AutomationAction>) {
  switch (node.data.nodeType) {
    case NodeType.START:
      return `Start: ${node.data.config.title}`;
    case NodeType.TASK:
      return `Task: ${node.data.config.title}`;
    case NodeType.APPROVAL:
      return `Approval: ${node.data.config.title}`;
    case NodeType.AUTOMATED_STEP: {
      const actionLabel =
        automationsById.get(node.data.config.actionId)?.label || node.data.config.actionId || 'No Action';
      return `Auto Step: ${node.data.config.title} (${actionLabel})`;
    }
    case NodeType.END:
      return `End: ${node.data.config.endMessage}`;
    default:
      return node.id;
  }
}

export async function simulateWorkflow(
  request: SimulationRequest,
): Promise<SimulationResult> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const { nodes, edges } = request.workflow;

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    const nextNodes = adjacency.get(edge.source) ?? [];
    nextNodes.push(edge.target);
    adjacency.set(edge.source, nextNodes);
  });

  const automationsById = new Map(MOCK_AUTOMATIONS.map((action) => [action.id, action]));
  const visited = new Set<string>();
  const steps: SimulationStep[] = [];
  let stepNumber = 0;

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) {
      return;
    }

    const node = nodeLookup.get(nodeId);
    if (!node) {
      return;
    }

    visited.add(nodeId);
    stepNumber += 1;

    steps.push({
      stepNumber,
      nodeId: node.id,
      nodeType: node.data.nodeType,
      action: getNodeLabel(node, automationsById),
      status: 'completed',
      timestamp: new Date(DETERMINISTIC_START_TIME + stepNumber * 200).toISOString(),
    });

    const neighbors = adjacency.get(nodeId) ?? [];
    neighbors.forEach((nextId) => traverse(nextId));
  }

  nodes
    .filter((node) => node.data.nodeType === NodeType.START)
    .forEach((startNode) => traverse(startNode.id));

  return {
    success: true,
    steps,
    totalDuration: steps.length * 200,
    summary: `Workflow completed successfully with ${steps.length} step${steps.length === 1 ? '' : 's'}.`,
  };
}
