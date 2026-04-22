import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

import { NodeType, type ApprovalData, type NodeUiState, type WorkflowNode } from '../types';
import { areWorkflowNodePropsEqual, BaseNode } from './BaseNode';

function ApprovalNodeComponent({ data, selected }: NodeProps<WorkflowNode>) {
  const payload = data as { nodeType: NodeType.APPROVAL; config: ApprovalData; ui?: NodeUiState };
  const threshold =
    payload.config.autoApproveThreshold > 0
      ? `Auto at ${payload.config.autoApproveThreshold}`
      : 'Manual review';
  const summary = `${payload.config.approverRole} - ${threshold}`;

  return (
    <BaseNode
      collapsed={payload.ui?.collapsed}
      errors={payload.ui?.errors}
      label="Approval"
      onToggleCollapse={payload.ui?.toggleCollapse}
      selected={selected}
      summary={summary}
      title={payload.config.title || 'Approval'}
      variantClassName="workflow-node--approval"
    >
      <div className="workflow-node__badge">{payload.config.approverRole}</div>
    </BaseNode>
  );
}

export const ApprovalNode = memo(ApprovalNodeComponent, areWorkflowNodePropsEqual);
