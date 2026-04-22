import { useEffect, useState, type ReactNode } from 'react';

import {
  NodeType,
  type ApprovalData,
  type AutomationAction,
  type AutomatedStepData,
  type EndData,
  type NodeVersionEntry,
  type StartData,
  type TaskData,
  type WorkflowNode,
} from '../types';

interface NodeConfigPanelProps {
  automations: AutomationAction[];
  automationsError: string | null;
  automationsLoading: boolean;
  nodeHistory: NodeVersionEntry[];
  onUpdateNode: (id: string, node: WorkflowNode['data']) => void;
  selectedNode: WorkflowNode;
  validationErrors: string[];
}

interface KeyValueEditorProps {
  addLabel: string;
  emptyMessage: string;
  label: string;
  onChange: (value: Record<string, string>) => void;
  value?: Record<string, string>;
}

function formatHistoryPreview(nodeData: WorkflowNode['data']) {
  switch (nodeData.nodeType) {
    case NodeType.START:
      return nodeData.config.title || 'Untitled start';
    case NodeType.TASK:
      return `${nodeData.config.title || 'Untitled task'} • ${nodeData.config.assignee || 'No assignee'}`;
    case NodeType.APPROVAL:
      return `${nodeData.config.title || 'Untitled approval'} • ${nodeData.config.approverRole}`;
    case NodeType.AUTOMATED_STEP:
      return `${nodeData.config.title || 'Untitled automated step'} • ${nodeData.config.actionId || 'No action'}`;
    case NodeType.END:
      return nodeData.config.endMessage || 'No end message';
    default:
      return 'Version snapshot';
  }
}

function formatHistoryTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function areStringRecordsEqual(
  left: Record<string, string> | undefined,
  right: Record<string, string> | undefined,
) {
  const leftEntries = Object.entries(left ?? {}).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  const rightEntries = Object.entries(right ?? {}).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );

  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function summarizeHistoryChanges(current: WorkflowNode['data'], previous?: WorkflowNode['data']) {
  if (!previous || current.nodeType !== previous.nodeType) {
    return 'Initial version saved';
  }

  const changes: string[] = [];

  switch (current.nodeType) {
    case NodeType.START: {
      const previousConfig = previous.config as StartData;

      if (current.config.title !== previousConfig.title) {
        changes.push('Title updated');
      }
      if (!areStringRecordsEqual(current.config.metadata, previousConfig.metadata)) {
        changes.push('Metadata updated');
      }
      break;
    }

    case NodeType.TASK: {
      const previousConfig = previous.config as TaskData;

      if (current.config.title !== previousConfig.title) {
        changes.push('Title updated');
      }
      if (current.config.description !== previousConfig.description) {
        changes.push('Description updated');
      }
      if (current.config.assignee !== previousConfig.assignee) {
        changes.push('Assignee updated');
      }
      if (current.config.dueDate !== previousConfig.dueDate) {
        changes.push('Due date updated');
      }
      if (!areStringRecordsEqual(current.config.customFields, previousConfig.customFields)) {
        changes.push('Custom fields updated');
      }
      break;
    }

    case NodeType.APPROVAL: {
      const previousConfig = previous.config as ApprovalData;

      if (current.config.title !== previousConfig.title) {
        changes.push('Title updated');
      }
      if (current.config.approverRole !== previousConfig.approverRole) {
        changes.push('Approver role updated');
      }
      if (current.config.autoApproveThreshold !== previousConfig.autoApproveThreshold) {
        changes.push('Threshold updated');
      }
      break;
    }

    case NodeType.AUTOMATED_STEP: {
      const previousConfig = previous.config as AutomatedStepData;

      if (current.config.title !== previousConfig.title) {
        changes.push('Title updated');
      }
      if (current.config.actionId !== previousConfig.actionId) {
        changes.push('Action updated');
      }
      if (!areStringRecordsEqual(current.config.parameters, previousConfig.parameters)) {
        changes.push('Parameters updated');
      }
      break;
    }

    case NodeType.END: {
      const previousConfig = previous.config as EndData;

      if (current.config.endMessage !== previousConfig.endMessage) {
        changes.push('End message updated');
      }
      if (current.config.summaryFlag !== previousConfig.summaryFlag) {
        changes.push('Summary flag updated');
      }
      break;
    }
  }

  if (changes.length === 0) {
    return 'No field-level changes detected';
  }

  if (changes.length <= 2) {
    return changes.join(' / ');
  }

  return `${changes.slice(0, 2).join(' / ')} +${changes.length - 2} more`;
}

function KeyValueEditor({ addLabel, emptyMessage, label, onChange, value }: KeyValueEditorProps) {
  const record = value ?? {};
  const entries = Object.entries(record);

  const handleAddRow = () => {
    let nextIndex = entries.length + 1;
    let nextKey = `key_${nextIndex}`;

    while (record[nextKey] !== undefined) {
      nextIndex += 1;
      nextKey = `key_${nextIndex}`;
    }

    onChange({ ...record, [nextKey]: '' });
  };

  const handleKeyChange = (currentKey: string, nextKey: string) => {
    const nextRecord = Object.fromEntries(
      entries.map(([entryKey, entryValue]) =>
        entryKey === currentKey ? [nextKey, entryValue] : [entryKey, entryValue],
      ),
    );
    onChange(nextRecord);
  };

  const handleValueChange = (currentKey: string, nextValue: string) => {
    onChange({ ...record, [currentKey]: nextValue });
  };

  const handleRemoveRow = (currentKey: string) => {
    const nextRecord = { ...record };
    delete nextRecord[currentKey];
    onChange(nextRecord);
  };

  return (
    <div className="field-group">
      <div className="field-group__header">
        <span>{label}</span>
        <button type="button" className="button button--ghost" onClick={handleAddRow}>
          {addLabel}
        </button>
      </div>

      {entries.length === 0 ? <p className="field-hint">{emptyMessage}</p> : null}

      <div className="key-value-list">
        {entries.map(([key, currentValue]) => (
          <div key={key} className="key-value-row">
            <input
              type="text"
              className="field-input"
              value={key}
              onChange={(event) => handleKeyChange(key, event.target.value)}
              placeholder="Key"
            />
            <input
              type="text"
              className="field-input"
              value={currentValue}
              onChange={(event) => handleValueChange(key, event.target.value)}
              placeholder="Value"
            />
            <button type="button" className="button button--ghost danger" onClick={() => handleRemoveRow(key)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NodeConfigPanel({
  automations,
  automationsError,
  automationsLoading,
  nodeHistory,
  onUpdateNode,
  selectedNode,
  validationErrors,
}: NodeConfigPanelProps) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  useEffect(() => {
    setIsHistoryExpanded(false);
  }, [selectedNode.id]);

  const updateNodeData = (data: WorkflowNode['data']) => {
    onUpdateNode(selectedNode.id, data);
  };

  const historyEntries = [...nodeHistory].reverse();
  const latestHistoryEntry = historyEntries[0] ?? null;

  let title = 'Configure node';
  let content: ReactNode = null;

  switch (selectedNode.data.nodeType) {
    case NodeType.START: {
      title = 'Configure start';
      const config: StartData = selectedNode.data.config;

      content = (
        <>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              className="field-input"
              value={config.title}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.START,
                  config: {
                    ...config,
                    title: event.target.value,
                  },
                })
              }
            />
          </label>

          <KeyValueEditor
            label="Metadata"
            addLabel="Add metadata"
            emptyMessage="No metadata added yet."
            value={config.metadata}
            onChange={(metadata) =>
              updateNodeData({
                nodeType: NodeType.START,
                config: {
                  ...config,
                  metadata,
                },
              })
            }
          />
        </>
      );
      break;
    }

    case NodeType.TASK: {
      title = 'Configure task';
      const config: TaskData = selectedNode.data.config;

      content = (
        <>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              className="field-input"
              value={config.title}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.TASK,
                  config: {
                    ...config,
                    title: event.target.value,
                  },
                })
              }
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              className="field-input field-input--textarea"
              value={config.description}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.TASK,
                  config: {
                    ...config,
                    description: event.target.value,
                  },
                })
              }
            />
          </label>

          <label className="field">
            <span>Assignee</span>
            <input
              type="text"
              className="field-input"
              value={config.assignee}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.TASK,
                  config: {
                    ...config,
                    assignee: event.target.value,
                  },
                })
              }
            />
          </label>

          <label className="field">
            <span>Due Date</span>
            <input
              type="date"
              className="field-input"
              value={config.dueDate}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.TASK,
                  config: {
                    ...config,
                    dueDate: event.target.value,
                  },
                })
              }
            />
            <p className="field-hint">Choose the due date using the date, month, and year picker.</p>
          </label>

          <KeyValueEditor
            label="Custom Fields"
            addLabel="Add field"
            emptyMessage="No custom fields added yet."
            value={config.customFields}
            onChange={(customFields) =>
              updateNodeData({
                nodeType: NodeType.TASK,
                config: {
                  ...config,
                  customFields,
                },
              })
            }
          />
        </>
      );
      break;
    }

    case NodeType.APPROVAL: {
      title = 'Configure approval';
      const config: ApprovalData = selectedNode.data.config;

      content = (
        <>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              className="field-input"
              value={config.title}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.APPROVAL,
                  config: {
                    ...config,
                    title: event.target.value,
                  },
                })
              }
            />
          </label>

          <label className="field">
            <span>Approver Role</span>
            <select
              className="field-input"
              value={config.approverRole}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.APPROVAL,
                  config: {
                    ...config,
                    approverRole: event.target.value as ApprovalData['approverRole'],
                  },
                })
              }
            >
              <option value="Manager">Manager</option>
              <option value="HRBP">HRBP</option>
              <option value="Director">Director</option>
            </select>
          </label>

          <label className="field">
            <span>Auto Approve Threshold</span>
            <input
              type="number"
              className="field-input"
              value={config.autoApproveThreshold}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.APPROVAL,
                  config: {
                    ...config,
                    autoApproveThreshold: Number.parseInt(event.target.value, 10) || 0,
                  },
                })
              }
            />
          </label>
        </>
      );
      break;
    }

    case NodeType.AUTOMATED_STEP: {
      title = 'Configure automated step';
      const config: AutomatedStepData = selectedNode.data.config;
      const selectedAction = automations.find((action) => action.id === config.actionId) ?? null;

      content = (
        <>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              className="field-input"
              value={config.title}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.AUTOMATED_STEP,
                  config: {
                    ...config,
                    title: event.target.value,
                  },
                })
              }
            />
          </label>

          <label className="field">
            <span>Action</span>
            <select
              className="field-input"
              value={config.actionId}
              disabled={automationsLoading}
              onChange={(event) => {
                const nextActionId = event.target.value;
                const matchingAction = automations.find((action) => action.id === nextActionId);
                const nextParameters = matchingAction
                  ? Object.fromEntries(
                      matchingAction.params.map((param) => [param, config.parameters[param] ?? '']),
                    )
                  : {};

                updateNodeData({
                  nodeType: NodeType.AUTOMATED_STEP,
                  config: {
                    ...config,
                    actionId: nextActionId,
                    parameters: nextParameters,
                  },
                });
              }}
            >
              <option value="">{automationsLoading ? 'Loading actions...' : 'Select action'}</option>
              {automations.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>

          {automationsError ? <p className="field-error">{automationsError}</p> : null}

          {selectedAction ? (
            selectedAction.params.map((param) => (
              <label key={param} className="field">
                <span>{param}</span>
                <input
                  type="text"
                  className="field-input"
                  value={config.parameters[param] ?? ''}
                  onChange={(event) =>
                    updateNodeData({
                      nodeType: NodeType.AUTOMATED_STEP,
                      config: {
                        ...config,
                        parameters: {
                          ...config.parameters,
                          [param]: event.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
            ))
          ) : (
            <p className="field-hint">Choose an action to configure its parameters.</p>
          )}
        </>
      );
      break;
    }

    case NodeType.END: {
      title = 'Configure end';
      const config: EndData = selectedNode.data.config;

      content = (
        <>
          <label className="field">
            <span>End Message</span>
            <textarea
              className="field-input field-input--textarea"
              value={config.endMessage}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.END,
                  config: {
                    ...config,
                    endMessage: event.target.value,
                  },
                })
              }
            />
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={config.summaryFlag}
              onChange={(event) =>
                updateNodeData({
                  nodeType: NodeType.END,
                  config: {
                    ...config,
                    summaryFlag: event.target.checked,
                  },
                })
              }
            />
            <span>Include summary flag</span>
          </label>
        </>
      );
      break;
    }
  }

  return (
    <div className="panel-card">
      <div className="panel-card__header">
        <p className="eyebrow">Configuration</p>
        <h2>{title}</h2>
      </div>

      {validationErrors.length > 0 ? (
        <div className="status-card status-card--error">
          <h3>Node Validation</h3>
          <ul className="status-list">
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="status-card">
          <h3>Node Validation</h3>
          <p className="field-hint">This node is currently valid.</p>
        </div>
      )}

      <div className="form-layout">{content}</div>

      <div className="status-card">
        <div className="status-card__actions">
          <div>
            <h3>Node Version History</h3>
            <p className="field-hint">Quick snapshot of recent edits for this node.</p>
          </div>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setIsHistoryExpanded((current) => !current)}
          >
            {isHistoryExpanded ? 'Hide History' : 'Show History'}
          </button>
        </div>

        {isHistoryExpanded ? (
          historyEntries.length > 0 ? (
            <div className="version-history">
              <div className="version-history__summary">
                <span className="version-history__pill">{historyEntries.length} saved versions</span>
                <span className="version-history__pill">Latest first</span>
              </div>

              {historyEntries.map((entry, index) => (
                <div key={entry.id} className="version-history__item">
                  <div className="version-history__item-top">
                    <div className="version-history__item-heading">
                      <strong>{entry.label}</strong>
                      <small>{formatHistoryPreview(entry.data).replace('â€¢', '-')}</small>
                      <p className="version-history__change">
                        {summarizeHistoryChanges(entry.data, historyEntries[index + 1]?.data)}
                      </p>
                    </div>
                    <div className="version-history__meta">
                      <span className="version-history__index">v{historyEntries.length - index}</span>
                      <span className="version-history__time">{formatHistoryTimestamp(entry.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="field-hint">No edit history recorded yet.</p>
          )
        ) : (
          <div className="version-history__collapsed">
            <span className="version-history__pill">
              {historyEntries.length > 0 ? `${historyEntries.length} versions available` : 'No versions yet'}
            </span>
            <p className="field-hint">
              {latestHistoryEntry
                ? `Latest change: ${summarizeHistoryChanges(
                    latestHistoryEntry.data,
                    historyEntries[1]?.data,
                  )} at ${formatHistoryTimestamp(latestHistoryEntry.timestamp)}`
                : 'History will appear here after you make edits to this node.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
