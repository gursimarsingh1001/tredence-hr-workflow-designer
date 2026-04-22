import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

import { NodeType, type AutomatedStepData, type NodeUiState, type WorkflowNode } from '../types';
import { areWorkflowNodePropsEqual, BaseNode } from './BaseNode';

type AutomatedStepPayload = WorkflowNode;

function formatActionLabel(actionId: string) {
  if (!actionId) {
    return 'Select an action';
  }

  return actionId
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function AutomatedStepNodeComponent({ data, selected }: NodeProps<AutomatedStepPayload>) {
  const payload = data as {
    nodeType: NodeType.AUTOMATED_STEP;
    config: AutomatedStepData;
    ui?: NodeUiState;
  };
  const actionLabel = formatActionLabel(payload.config.actionId);
  const isActionMissing = !payload.config.actionId;
  const summary = isActionMissing ? 'Action required' : actionLabel;

  return (
    <BaseNode
      collapsed={payload.ui?.collapsed}
      errors={payload.ui?.errors}
      label="Automated Step"
      onToggleCollapse={payload.ui?.toggleCollapse}
      selected={selected}
      summary={summary}
      title={payload.config.title || 'Automated Step'}
      variantClassName="workflow-node--automated"
    >
      <div className="workflow-node__meta">
        <span className={isActionMissing ? 'workflow-node__meta-item is-invalid' : 'workflow-node__meta-item'}>
          {isActionMissing ? 'Action required' : actionLabel}
        </span>
      </div>
    </BaseNode>
  );
}

export const AutomatedStepNode = memo(AutomatedStepNodeComponent, areWorkflowNodePropsEqual);
