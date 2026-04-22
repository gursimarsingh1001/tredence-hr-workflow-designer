import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

import { NodeType, type EndData, type NodeUiState, type WorkflowNode } from '../types';
import { areWorkflowNodePropsEqual, BaseNode } from './BaseNode';

function EndNodeComponent({ data, selected }: NodeProps<WorkflowNode>) {
  const payload = data as { nodeType: NodeType.END; config: EndData; ui?: NodeUiState };
  const summary = payload.config.summaryFlag ? 'Summary included' : 'Final step';

  return (
    <BaseNode
      collapsed={payload.ui?.collapsed}
      errors={payload.ui?.errors}
      label="End"
      onToggleCollapse={payload.ui?.toggleCollapse}
      selected={selected}
      summary={summary}
      sourceHandle={false}
      title={payload.config.endMessage || 'Workflow Complete'}
      variantClassName="workflow-node--end"
    />
  );
}

export const EndNode = memo(EndNodeComponent, areWorkflowNodePropsEqual);
