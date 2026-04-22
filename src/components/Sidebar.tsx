import { NodeType } from '../types/workflow';

const NODE_PALETTE = [
  { type: NodeType.START, label: 'Start', hint: 'Kick off a workflow', colorClass: 'is-start', tag: 'S' },
  { type: NodeType.TASK, label: 'Task', hint: 'Assign work to a teammate', colorClass: 'is-task', tag: 'T' },
  { type: NodeType.APPROVAL, label: 'Approval', hint: 'Request a decision', colorClass: 'is-approval', tag: 'A' },
  {
    type: NodeType.AUTOMATED_STEP,
    label: 'Automated Step',
    hint: 'Trigger a system action',
    colorClass: 'is-automated',
    tag: 'AS',
  },
  { type: NodeType.END, label: 'End', hint: 'Finish the workflow', colorClass: 'is-end', tag: 'E' },
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

interface SidebarProps {
  onApplyTemplate: (templateId: string) => void;
}

export function Sidebar({ onApplyTemplate }: SidebarProps) {
  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__hero">
        <p className="eyebrow">HR Workflow Designer</p>
        <h1>Create HR processes visually</h1>
        <p className="sidebar__copy">
          Design onboarding, leave, and document flows with templates or drag custom steps onto the canvas.
        </p>
        <div className="sidebar__hero-pills">
          <span className="sidebar-pill">5 node types</span>
          <span className="sidebar-pill">Live validation</span>
          <span className="sidebar-pill">JSON import/export</span>
        </div>
      </div>

      <div className="sidebar__section sidebar__section--templates">
        <div className="sidebar__section-header">
          <h2>Quick Templates</h2>
          <span>Start instantly</span>
        </div>
        <div className="sidebar__list">
          {WORKFLOW_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="template-card"
              onClick={() => onApplyTemplate(template.id)}
            >
              <span className="template-card__row">
                <span className="template-card__title">{template.label}</span>
                <span className="template-card__action">Use template</span>
              </span>
              <span className="template-card__hint">{template.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar__section sidebar__section--nodes">
        <div className="sidebar__section-header">
          <h2>Custom Nodes</h2>
          <span>Drag to canvas</span>
        </div>
        <div className="sidebar__list">
          {NODE_PALETTE.map((node) => (
            <button
              key={node.type}
              type="button"
              className={`palette-card ${node.colorClass}`}
              draggable
              onDragStart={(event) => handleDragStart(event, node.type)}
            >
              <span className={`palette-card__icon ${node.colorClass}`}>{node.tag}</span>
              <span className="palette-card__body">
                <span className="palette-card__row">
                  <span className="palette-card__title">{node.label}</span>
                  <span className="palette-card__action">Drag</span>
                </span>
                <span className="palette-card__hint">{node.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
