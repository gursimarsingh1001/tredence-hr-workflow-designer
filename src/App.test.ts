import { describe, expect, it } from 'vitest';

import { appendWorkflowTemplate, createTemplateWorkflow } from './App';

describe('appendWorkflowTemplate', () => {
  it('keeps existing template nodes and appends another template as a separate workflow group', () => {
    const firstWorkflow = createTemplateWorkflow('onboarding');
    const combinedWorkflow = appendWorkflowTemplate(firstWorkflow, createTemplateWorkflow('leave_approval'));

    expect(combinedWorkflow.nodes).toHaveLength(10);
    expect(combinedWorkflow.edges).toHaveLength(8);

    const existingNodeIds = new Set(firstWorkflow.nodes.map((node) => node.id));
    const appendedNodeIds = combinedWorkflow.nodes
      .map((node) => node.id)
      .filter((id) => !existingNodeIds.has(id));

    expect(appendedNodeIds).toHaveLength(5);

    const firstClusterMaxY = Math.max(...firstWorkflow.nodes.map((node) => node.position.y));
    const secondClusterMinY = Math.min(
      ...combinedWorkflow.nodes
        .filter((node) => appendedNodeIds.includes(node.id))
        .map((node) => node.position.y),
    );

    expect(secondClusterMinY).toBeGreaterThan(firstClusterMaxY);
  });

  it('keeps document verification on generate_doc and uses unnamed default edge handles', () => {
    const workflow = createTemplateWorkflow('document_verification');
    const automatedNode = workflow.nodes.find((node) => node.id === 'doc-auto');

    expect(automatedNode?.type).toBe('automated_step');
    expect(automatedNode?.data.nodeType).toBe('automated_step');
    expect(
      automatedNode?.data.nodeType === 'automated_step'
        ? automatedNode.data.config.actionId
        : undefined,
    ).toBe('generate_doc');
    expect(
      workflow.edges.every(
        (edge) => edge.sourceHandle === undefined && edge.targetHandle === undefined,
      ),
    ).toBe(true);
  });
});
