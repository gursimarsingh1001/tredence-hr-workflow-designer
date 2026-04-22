import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

import { NodeType, type NodeUiState, type StartData, type WorkflowNode } from '../types';
import { areWorkflowNodePropsEqual, BaseNode } from './BaseNode';

function StartNodeComponent({ data, selected }: NodeProps<WorkflowNode>) {
  const payload = data as { nodeType: NodeType.START; config: StartData; ui?: NodeUiState };
  const metadataCount = Object.keys(payload.config.metadata ?? {}).length;
  const summary =
    metadataCount > 0
      ? `${metadataCount} metadata field${metadataCount === 1 ? '' : 's'}`
      : 'Kick off the workflow';

  return (
    <BaseNode
      collapsed={payload.ui?.collapsed}
      errors={payload.ui?.errors}
      label="Start"
      onToggleCollapse={payload.ui?.toggleCollapse}
      selected={selected}
      summary={summary}
      sourceHandle
      targetHandle={false}
      title={payload.config.title || 'Workflow Start'}
      variantClassName="workflow-node--start"
    />
  );
}

export const StartNode = memo(StartNodeComponent, areWorkflowNodePropsEqual);
