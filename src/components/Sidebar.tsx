import { useMemo, useState } from 'react';

import { NodeType } from '../types/workflow';

const NODE_PALETTE = [
  { type: NodeType.START, label: 'Start', hint: 'Kick off a workflow', colorClass: 'is-start', tag: 'TR' },
  { type: NodeType.TASK, label: 'Task', hint: 'Assign work to a teammate', colorClass: 'is-task', tag: 'AC' },
  { type: NodeType.APPROVAL, label: 'Approval', hint: 'Request a decision', colorClass: 'is-approval', tag: 'LG' },
  {
    type: NodeType.AUTOMATED_STEP,
    label: 'Automated Step',
    hint: 'Trigger a system action',
    colorClass: 'is-automated',
    tag: 'AC',
  },
  { type: NodeType.END, label: 'End', hint: 'Finish the workflow', colorClass: 'is-end', tag: 'LG' },
];

const WORKFLOW_TEMPLATES = [
  {
    id: 'onboarding',
    label: 'Employee Onboarding',
    hint: 'Welcome, approvals, and setup.',
  },
  {
    id: 'leave_approval',
    label: 'Leave Approval',
    hint: 'Request, approval, and confirmation.',
  },
  {
    id: 'document_verification',
    label: 'Document Verification',
    hint: 'Collect, verify, and close the case.',
  },
];

const NODE_GROUPS = [
  {
    title: 'Triggers',
    items: [NODE_PALETTE[0]],
  },
  {
    title: 'Actions',
    items: [NODE_PALETTE[1], NODE_PALETTE[3]],
  },
  {
    title: 'Logic',
    items: [NODE_PALETTE[2], NODE_PALETTE[4]],
  },
];

interface SidebarProps {
  onApplyTemplate: (templateId: string) => void;
  onStartFromScratch: () => void;
}

export function Sidebar({ onApplyTemplate, onStartFromScratch }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'nodes' | 'templates'>('nodes');
  const [searchValue, setSearchValue] = useState('');

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const query = searchValue.trim().toLowerCase();

  const filteredGroups = useMemo(
    () =>
      NODE_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            !query ||
            item.label.toLowerCase().includes(query) ||
            item.hint.toLowerCase().includes(query),
        ),
      })).filter((group) => group.items.length > 0),
    [query],
  );

  const filteredTemplates = useMemo(
    () =>
      WORKFLOW_TEMPLATES.filter(
        (template) =>
          !query ||
          template.label.toLowerCase().includes(query) ||
          template.hint.toLowerCase().includes(query),
      ),
    [query],
  );

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__header-icon">🛠</div>
        <div>
          <h2>Toolbox</h2>
          <p>Workflow Components</p>
        </div>
      </div>

      <div className="sidebar__search">
        <input
          type="text"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search nodes..."
          aria-label="Search nodes"
        />
      </div>

      <div className="sidebar__tabs">
        <button
          type="button"
          className={`sidebar__tab${activeTab === 'nodes' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('nodes')}
        >
          Node Types
        </button>
        <button
          type="button"
          className={`sidebar__tab${activeTab === 'templates' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
      </div>

      <div className="sidebar__body">
        {activeTab === 'nodes' ? (
          filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <section key={group.title} className="toolbox-group">
                <div className="toolbox-group__header">
                  <h3>{group.title}</h3>
                </div>

                <div className="toolbox-grid">
                  {group.items.map((node) => (
                    <button
                      key={node.type}
                      type="button"
                      className={`toolbox-card ${node.colorClass}`}
                      draggable
                      onDragStart={(event) => handleDragStart(event, node.type)}
                    >
                      <span className={`toolbox-card__icon ${node.colorClass}`}>{node.tag}</span>
                      <span className="toolbox-card__title">{node.label}</span>
                      <span className="toolbox-card__hint">{node.hint}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="sidebar__empty">No matching node types.</div>
          )
        ) : filteredTemplates.length > 0 ? (
          <section className="toolbox-group">
            <div className="toolbox-group__header">
              <h3>Quick Templates</h3>
            </div>

            <div className="toolbox-template-list">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="toolbox-template"
                  onClick={() => onApplyTemplate(template.id)}
                >
                  <span className="toolbox-template__title">{template.label}</span>
                  <span className="toolbox-template__hint">{template.hint}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="sidebar__empty">No matching templates.</div>
        )}
      </div>

      <div className="sidebar__footer">
        <button type="button" className="button button--ghost sidebar__footer-button" onClick={onStartFromScratch}>
          + Add Custom Node
        </button>
      </div>
    </aside>
  );
}
