import { NodeType, type WorkflowEdge, type WorkflowNode } from '../types';

export interface ValidationError {
  message: string;
  nodeId?: string;
  shortMessage?: string;
  type: 'error';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export function getNodeDisplayName(node: WorkflowNode) {
  switch (node.data.nodeType) {
    case NodeType.START:
    case NodeType.TASK:
    case NodeType.APPROVAL:
    case NodeType.AUTOMATED_STEP:
      return node.data.config.title.trim() || node.id;
    case NodeType.END:
      return node.data.config.endMessage.trim() || node.id;
    default:
      return node.id;
  }
}

function createNodeError(
  node: WorkflowNode,
  message: string,
  shortMessage: string,
): ValidationError {
  return {
    message,
    nodeId: node.id,
    shortMessage,
    type: 'error',
  };
}

export function groupValidationErrorsByNode(errors: ValidationError[]) {
  return errors.reduce<Record<string, string[]>>((accumulator, error) => {
    if (!error.nodeId) {
      return accumulator;
    }

    const nextMessage = error.shortMessage ?? error.message;
    const existingMessages = accumulator[error.nodeId] ?? [];

    if (!existingMessages.includes(nextMessage)) {
      accumulator[error.nodeId] = [...existingMessages, nextMessage];
    }

    return accumulator;
  }, {});
}

export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationResult {
  const errors: ValidationError[] = [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const startNodes = nodes.filter((node) => node.data.nodeType === NodeType.START);
  if (startNodes.length === 0) {
    errors.push({ message: 'Must have at least 1 Start node', type: 'error' });
  }

  const endNodes = nodes.filter((node) => node.data.nodeType === NodeType.END);
  if (endNodes.length === 0) {
    errors.push({ message: 'Must have at least 1 End node', type: 'error' });
  }

  const startIds = new Set(startNodes.map((node) => node.id));
  edges.forEach((edge) => {
    if (startIds.has(edge.target)) {
      const startNode = nodeById.get(edge.target);
      if (startNode) {
        errors.push(
          createNodeError(
            startNode,
            `Start node "${getNodeDisplayName(startNode)}" cannot have incoming connections`,
            'Incoming edge not allowed',
          ),
        );
      }
    }
  });

  if (nodes.length > 1 && startNodes.length > 0) {
    const reachableFromStart = new Set<string>();

    function dfsReachable(nodeId: string) {
      if (reachableFromStart.has(nodeId)) {
        return;
      }

      reachableFromStart.add(nodeId);
      edges
        .filter((edge) => edge.source === nodeId)
        .forEach((edge) => dfsReachable(edge.target));
    }

    startNodes.forEach((startNode) => dfsReachable(startNode.id));

    nodes.forEach((node) => {
      if (node.data.nodeType !== NodeType.START && !reachableFromStart.has(node.id)) {
        errors.push(
          createNodeError(
            node,
            `Node "${getNodeDisplayName(node)}" is disconnected (not reachable from Start via traversal)`,
            'Disconnected',
          ),
        );
      }
    });
  }

  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => adjacency.set(node.id, []));
  edges.forEach((edge) => {
    const nextNodes = adjacency.get(edge.source);
    if (nextNodes) {
      nextNodes.push(edge.target);
    }
  });

  nodes.forEach((node) => {
    if (node.data.nodeType === NodeType.END || nodes.length <= 1) {
      return;
    }

    const outgoingCount = adjacency.get(node.id)?.length ?? 0;
    if (outgoingCount === 0) {
      errors.push(
        createNodeError(
          node,
          `Node "${getNodeDisplayName(node)}" is missing an outgoing connection`,
          'Connection required',
        ),
      );
    }
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function findCycle(nodeId: string): string | null {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const nextId of adjacency.get(nodeId) ?? []) {
      if (!visited.has(nextId)) {
        const cycleNodeId = findCycle(nextId);
        if (cycleNodeId) {
          return cycleNodeId;
        }
      } else if (recursionStack.has(nextId)) {
        return nextId;
      }
    }

    recursionStack.delete(nodeId);
    return null;
  }

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }

    const cycleNodeId = findCycle(node.id);
    if (!cycleNodeId) {
      continue;
    }

    const cycleNode = nodeById.get(cycleNodeId);
    if (cycleNode) {
      errors.push(
        createNodeError(
          cycleNode,
          `Workflow contains a cycle near "${getNodeDisplayName(cycleNode)}"`,
          'Cycle detected',
        ),
      );
    } else {
      errors.push({ message: 'Workflow contains a cycle (must be acyclic/DAG)', type: 'error' });
    }
    break;
  }

  nodes.forEach((node) => {
    const nodeName = getNodeDisplayName(node);

    switch (node.data.nodeType) {
      case NodeType.START: {
        const config = node.data.config;
        if (!config.title.trim()) {
          errors.push(createNodeError(node, `Start node "${nodeName}" missing title`, 'Title required'));
        }
        break;
      }

      case NodeType.TASK: {
        const config = node.data.config;
        if (!config.title.trim()) {
          errors.push(createNodeError(node, `Task node "${nodeName}" missing title`, 'Title required'));
        }
        if (!config.assignee.trim()) {
          errors.push(
            createNodeError(node, `Task node "${nodeName}" missing assignee`, 'Assignee required'),
          );
        }
        break;
      }

      case NodeType.APPROVAL: {
        const config = node.data.config;
        if (!config.title.trim()) {
          errors.push(createNodeError(node, `Approval node "${nodeName}" missing title`, 'Title required'));
        }
        if (!config.approverRole) {
          errors.push(
            createNodeError(
              node,
              `Approval node "${nodeName}" missing approver role`,
              'Approver role required',
            ),
          );
        }
        break;
      }

      case NodeType.AUTOMATED_STEP: {
        const config = node.data.config;
        if (!config.title.trim()) {
          errors.push(
            createNodeError(
              node,
              `Automated Step node "${nodeName}" missing title`,
              'Title required',
            ),
          );
        }
        if (!config.actionId) {
          errors.push(
            createNodeError(
              node,
              `Automated Step node "${nodeName}" missing action selection`,
              'Action required',
            ),
          );
        }
        break;
      }

      case NodeType.END: {
        const config = node.data.config;
        if (!config.endMessage.trim()) {
          errors.push(
            createNodeError(
              node,
              `End node "${nodeName}" missing end message`,
              'End message required',
            ),
          );
        }
        break;
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
