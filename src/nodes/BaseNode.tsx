import type { ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { WorkflowNode } from '../types';

interface BaseNodeProps {
  children?: ReactNode;
  collapsed?: boolean;
  errors?: string[];
  label: string;
  onToggleCollapse?: () => void;
  selected: boolean;
  sourceHandle?: boolean;
  summary?: string;
  targetHandle?: boolean;
  title: string;
  variantClassName: string;
}

export function areWorkflowNodePropsEqual(
  previous: NodeProps<WorkflowNode>,
  next: NodeProps<WorkflowNode>,
) {
  return (
    previous.data === next.data &&
    previous.selected === next.selected &&
    previous.sourcePosition === next.sourcePosition &&
    previous.targetPosition === next.targetPosition
  );
}

export function BaseNode({
  children,
  collapsed = false,
  errors = [],
  label,
  onToggleCollapse,
  selected,
  sourceHandle = true,
  summary,
  targetHandle = true,
  title,
  variantClassName,
}: BaseNodeProps) {
  const hasErrors = errors.length > 0;

  return (
    <div
      className={`workflow-node ${variantClassName}${selected ? ' is-selected' : ''}${hasErrors ? ' is-invalid' : ''}${collapsed ? ' is-collapsed' : ''}`}
    >
      {/* Default unnamed handles keep the MVP edge model simple.
          We only need explicit handle ids if we later introduce multiple named ports per node. */}
      {targetHandle ? <Handle type="target" position={Position.Top} /> : null}
      <div className="workflow-node__header workflow-node__drag-handle">
        <div className="workflow-node__heading">
          <div className="workflow-node__label">{label}</div>
          <div className="workflow-node__title">{title}</div>
          {summary ? <div className="workflow-node__summary">{summary}</div> : null}
        </div>
        <div className="workflow-node__controls">
          {hasErrors ? <span className="workflow-node__error-badge">!</span> : null}
          {onToggleCollapse ? (
            <button
              type="button"
              className="workflow-node__collapse"
              aria-label={collapsed ? 'Expand node' : 'Collapse node'}
              title={collapsed ? 'Expand card' : 'Collapse to compact card'}
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapse();
              }}
            >
              {collapsed ? '+' : '-'}
            </button>
          ) : null}
        </div>
      </div>
      {!collapsed ? children : null}
      {!collapsed && hasErrors ? (
        <div className="workflow-node__errors">
          {errors.slice(0, 2).map((error) => (
            <span key={error} className="workflow-node__error-text">
              {error}
            </span>
          ))}
        </div>
      ) : null}
      {sourceHandle ? <Handle type="source" position={Position.Bottom} /> : null}
    </div>
  );
}
