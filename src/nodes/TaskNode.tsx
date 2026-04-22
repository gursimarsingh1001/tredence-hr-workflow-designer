import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

import { NodeType, type NodeUiState, type TaskData, type WorkflowNode } from '../types';
import { areWorkflowNodePropsEqual, BaseNode } from './BaseNode';

function TaskNodeComponent({ data, selected }: NodeProps<WorkflowNode>) {
  const payload = data as { nodeType: NodeType.TASK; config: TaskData; ui?: NodeUiState };
  const assigneeText = payload.config.assignee || 'Assignee required';
  const isAssigneeMissing = !payload.config.assignee.trim();
  const summary = payload.config.description.trim()
    ? payload.config.description.trim().slice(0, 72)
    : isAssigneeMissing
      ? 'Assignee required'
      : `Assigned to ${payload.config.assignee}`;

  return (
    <BaseNode
      collapsed={payload.ui?.collapsed}
      errors={payload.ui?.errors}
      label="Task"
      onToggleCollapse={payload.ui?.toggleCollapse}
      selected={selected}
      summary={summary}
      title={payload.config.title || 'New Task'}
      variantClassName="workflow-node--task"
    >
      <div className="workflow-node__meta">
        <span className={isAssigneeMissing ? 'workflow-node__meta-item is-invalid' : 'workflow-node__meta-item'}>
          {assigneeText}
        </span>
        <span>{payload.config.dueDate || 'No due date'}</span>
      </div>
    </BaseNode>
  );
}

export const TaskNode = memo(TaskNodeComponent, areWorkflowNodePropsEqual);
