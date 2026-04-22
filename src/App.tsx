import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Sidebar, Toolbar, WorkflowCanvas } from './components';
import { useWorkflowState } from './hooks';
import { NodeConfigPanel, SandboxPanel } from './panels';
import { getAutomations, simulateWorkflow } from './services';
import {
  NodeType,
  type AutomationAction,
  type NodeData,
  type SimulationRequest,
  type SimulationResult,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
} from './types';
import { groupValidationErrorsByNode, validateWorkflow } from './utils';

type PanelMode = 'config' | 'sandbox';

const TEMPLATE_X_GAP = 292;
const TEMPLATE_Y = 160;
const TEMPLATE_CLUSTER_X = 40;
const TEMPLATE_CLUSTER_GAP_Y = 240;

function createTemplateEdge(id: string, source: string, target: string): WorkflowEdge {
  return {
    id,
    source,
    target,
  };
}

function sanitizeRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [String(key), String(entryValue ?? '')]),
  );
}

function stripNodeUi(data: NodeData): NodeData {
  const { ui: _ui, ...rest } = data;
  return rest;
}

function toSerializableWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowDefinition {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      data: stripNodeUi(node.data),
    })),
    edges: edges.map((edge) => ({ ...edge })),
  };
}

function createWorkflowNode(
  id: string,
  type: NodeType,
  x: number,
  data: NodeData,
): WorkflowNode {
  return {
    id,
    type,
    position: { x, y: TEMPLATE_Y },
    data,
  };
}

function getNextClusterOrigin(nodes: WorkflowNode[]) {
  if (nodes.length === 0) {
    return { x: TEMPLATE_CLUSTER_X, y: TEMPLATE_Y };
  }

  return {
    x: TEMPLATE_CLUSTER_X,
    y: Math.max(...nodes.map((node) => node.position.y)) + TEMPLATE_CLUSTER_GAP_Y,
  };
}

function createStarterNode(origin = { x: 180, y: 180 }): WorkflowNode {
  return {
    id: uuidv4(),
    type: NodeType.START,
    position: origin,
    data: {
      nodeType: NodeType.START,
      config: {
        title: 'Workflow Start',
        metadata: {},
      },
    },
  };
}

export function createTemplateWorkflow(templateId: string): WorkflowDefinition {
  switch (templateId) {
    case 'leave_approval': {
      return {
        nodes: [
          createWorkflowNode('leave-start', NodeType.START, 40, {
            nodeType: NodeType.START,
            config: { title: 'Leave Request Start', metadata: { department: 'HR' } },
          }),
          createWorkflowNode('leave-task', NodeType.TASK, 40 + TEMPLATE_X_GAP, {
            nodeType: NodeType.TASK,
            config: {
              title: 'Capture Leave Request',
              description: 'Collect leave dates and reason.',
              assignee: 'HR Coordinator',
              dueDate: '',
              customFields: { leaveType: 'Annual' },
            },
          }),
          createWorkflowNode('leave-approval', NodeType.APPROVAL, 40 + TEMPLATE_X_GAP * 2, {
            nodeType: NodeType.APPROVAL,
            config: {
              title: 'Manager Approval',
              approverRole: 'Manager',
              autoApproveThreshold: 0,
            },
          }),
          createWorkflowNode('leave-auto', NodeType.AUTOMATED_STEP, 40 + TEMPLATE_X_GAP * 3, {
            nodeType: NodeType.AUTOMATED_STEP,
            config: {
              title: 'Send Confirmation Email',
              actionId: 'send_email',
              parameters: {
                to: 'employee@company.com',
                subject: 'Leave request approved',
                body: 'Your leave request is approved and recorded.',
              },
            },
          }),
          createWorkflowNode('leave-end', NodeType.END, 40 + TEMPLATE_X_GAP * 4, {
            nodeType: NodeType.END,
            config: { endMessage: 'Leave workflow complete', summaryFlag: true },
          }),
        ],
        edges: [
          createTemplateEdge('leave-edge-1', 'leave-start', 'leave-task'),
          createTemplateEdge('leave-edge-2', 'leave-task', 'leave-approval'),
          createTemplateEdge('leave-edge-3', 'leave-approval', 'leave-auto'),
          createTemplateEdge('leave-edge-4', 'leave-auto', 'leave-end'),
        ],
      };
    }

    case 'document_verification': {
      return {
        nodes: [
          createWorkflowNode('doc-start', NodeType.START, 40, {
            nodeType: NodeType.START,
            config: { title: 'Verification Start', metadata: { workflow: 'Documents' } },
          }),
          createWorkflowNode('doc-task', NodeType.TASK, 40 + TEMPLATE_X_GAP, {
            nodeType: NodeType.TASK,
            config: {
              title: 'Collect Documents',
              description: 'Upload identity and employment proof.',
              assignee: 'HR Ops',
              // dueDate stays optional in the MVP form state, so an empty string is intentional here.
              dueDate: '',
              customFields: { priority: 'High' },
            },
          }),
          createWorkflowNode('doc-approval', NodeType.APPROVAL, 40 + TEMPLATE_X_GAP * 2, {
            nodeType: NodeType.APPROVAL,
            config: {
              title: 'Verify Records',
              approverRole: 'HRBP',
              autoApproveThreshold: 0,
            },
          }),
          createWorkflowNode('doc-auto', NodeType.AUTOMATED_STEP, 40 + TEMPLATE_X_GAP * 3, {
            nodeType: NodeType.AUTOMATED_STEP,
            config: {
              title: 'Generate Verification Summary',
              actionId: 'generate_doc',
              parameters: {
                template: 'verification_summary',
                recipient: 'hr@company.com',
              },
            },
          }),
          createWorkflowNode('doc-end', NodeType.END, 40 + TEMPLATE_X_GAP * 4, {
            nodeType: NodeType.END,
            config: { endMessage: 'Documents verified', summaryFlag: true },
          }),
        ],
        edges: [
          createTemplateEdge('doc-edge-1', 'doc-start', 'doc-task'),
          createTemplateEdge('doc-edge-2', 'doc-task', 'doc-approval'),
          createTemplateEdge('doc-edge-3', 'doc-approval', 'doc-auto'),
          createTemplateEdge('doc-edge-4', 'doc-auto', 'doc-end'),
        ],
      };
    }

    case 'onboarding':
    default:
      return {
        nodes: [
          createWorkflowNode('onboard-start', NodeType.START, 40, {
            nodeType: NodeType.START,
            config: { title: 'Onboarding Start', metadata: { team: 'People Ops' } },
          }),
          createWorkflowNode('onboard-task', NodeType.TASK, 40 + TEMPLATE_X_GAP, {
            nodeType: NodeType.TASK,
            config: {
              title: 'Collect Employee Details',
              description: 'Capture personal and role-specific onboarding info.',
              assignee: 'HR Admin',
              dueDate: '',
              customFields: { buddy: 'Assigned' },
            },
          }),
          createWorkflowNode('onboard-approval', NodeType.APPROVAL, 40 + TEMPLATE_X_GAP * 2, {
            nodeType: NodeType.APPROVAL,
            config: {
              title: 'Manager Sign-off',
              approverRole: 'Manager',
              autoApproveThreshold: 0,
            },
          }),
          createWorkflowNode('onboard-auto', NodeType.AUTOMATED_STEP, 40 + TEMPLATE_X_GAP * 3, {
            nodeType: NodeType.AUTOMATED_STEP,
            config: {
              title: 'Send Welcome Kit',
              actionId: 'send_email',
              parameters: {
                to: 'newhire@company.com',
                subject: 'Welcome to the company',
                body: 'Please review your onboarding checklist and welcome resources.',
              },
            },
          }),
          createWorkflowNode('onboard-end', NodeType.END, 40 + TEMPLATE_X_GAP * 4, {
            nodeType: NodeType.END,
            config: { endMessage: 'Onboarding complete', summaryFlag: true },
          }),
        ],
        edges: [
          createTemplateEdge('onboard-edge-1', 'onboard-start', 'onboard-task'),
          createTemplateEdge('onboard-edge-2', 'onboard-task', 'onboard-approval'),
          createTemplateEdge('onboard-edge-3', 'onboard-approval', 'onboard-auto'),
          createTemplateEdge('onboard-edge-4', 'onboard-auto', 'onboard-end'),
        ],
      };
  }
}

export function appendWorkflowTemplate(
  currentWorkflow: WorkflowDefinition,
  templateWorkflow: WorkflowDefinition,
): WorkflowDefinition {
  const origin = getNextClusterOrigin(currentWorkflow.nodes);
  const sourceMinX = Math.min(...templateWorkflow.nodes.map((node) => node.position.x));
  const sourceMinY = Math.min(...templateWorkflow.nodes.map((node) => node.position.y));
  const idMap = new Map<string, string>();

  templateWorkflow.nodes.forEach((node) => {
    idMap.set(node.id, `${node.id}-${uuidv4().slice(0, 8)}`);
  });

  const appendedNodes = templateWorkflow.nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id) ?? `${node.id}-${uuidv4().slice(0, 8)}`,
    position: {
      x: origin.x + (node.position.x - sourceMinX),
      y: origin.y + (node.position.y - sourceMinY),
    },
  }));

  const appendedEdges = templateWorkflow.edges.map((edge) => ({
    ...edge,
    id: `${edge.id}-${uuidv4().slice(0, 8)}`,
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target,
  }));

  return {
    nodes: [...currentWorkflow.nodes, ...appendedNodes],
    edges: [...currentWorkflow.edges, ...appendedEdges],
  };
}

function autoArrangeWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowDefinition {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const adjacency = new Map<string, string[]>();
  const incomingCounts = new Map<string, number>();

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
    incomingCounts.set(node.id, 0);
  });

  edges.forEach((edge) => {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    incomingCounts.set(edge.target, (incomingCounts.get(edge.target) ?? 0) + 1);
  });

  const queue = nodes
    .filter((node) => node.type === NodeType.START || (incomingCounts.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const seen = new Set(queue);
  const depth = new Map(queue.map((nodeId) => [nodeId, 0]));

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    const currentDepth = depth.get(currentId) ?? 0;
    for (const nextId of adjacency.get(currentId) ?? []) {
      const nextDepth = Math.max(depth.get(nextId) ?? 0, currentDepth + 1);
      depth.set(nextId, nextDepth);

      if (!seen.has(nextId)) {
        seen.add(nextId);
        queue.push(nextId);
      }
    }
  }

  let fallbackDepth = Math.max(...depth.values(), 0) + 1;
  nodes.forEach((node) => {
    if (!depth.has(node.id)) {
      depth.set(node.id, fallbackDepth);
      fallbackDepth += 1;
    }
  });

  const columnCounts = new Map<number, number>();
  const arrangedNodes = nodes.map((node) => {
    const column = depth.get(node.id) ?? 0;
    const row = columnCounts.get(column) ?? 0;
    columnCounts.set(column, row + 1);

    return {
      ...node,
      position: {
        x: 88 + column * 304,
        y: 100 + row * 184,
      },
    };
  });

  return {
    nodes: arrangedNodes,
    edges: edges.map((edge) => ({ ...edge })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeNodeData(nodeType: NodeType, rawData: unknown): NodeData {
  const config = isRecord(rawData) && isRecord(rawData.config) ? rawData.config : {};

  switch (nodeType) {
    case NodeType.START:
      return {
        nodeType,
        config: {
          title: typeof config.title === 'string' ? config.title : 'Workflow Start',
          metadata: sanitizeRecord(config.metadata),
        },
      };

    case NodeType.TASK:
      return {
        nodeType,
        config: {
          title: typeof config.title === 'string' ? config.title : 'New Task',
          description: typeof config.description === 'string' ? config.description : '',
          assignee: typeof config.assignee === 'string' ? config.assignee : '',
          dueDate: typeof config.dueDate === 'string' ? config.dueDate : '',
          customFields: sanitizeRecord(config.customFields),
        },
      };

    case NodeType.APPROVAL:
      return {
        nodeType,
        config: {
          title: typeof config.title === 'string' ? config.title : 'Approval',
          approverRole:
            config.approverRole === 'HRBP' || config.approverRole === 'Director'
              ? config.approverRole
              : 'Manager',
          autoApproveThreshold:
            typeof config.autoApproveThreshold === 'number' ? config.autoApproveThreshold : 0,
        },
      };

    case NodeType.AUTOMATED_STEP:
      return {
        nodeType,
        config: {
          title: typeof config.title === 'string' ? config.title : 'Automated Step',
          actionId: typeof config.actionId === 'string' ? config.actionId : '',
          parameters: sanitizeRecord(config.parameters),
        },
      };

    case NodeType.END:
      return {
        nodeType,
        config: {
          endMessage: typeof config.endMessage === 'string' ? config.endMessage : 'Workflow Complete',
          summaryFlag: typeof config.summaryFlag === 'boolean' ? config.summaryFlag : false,
        },
      };
  }
}

function normalizeImportedWorkflow(source: string): WorkflowDefinition {
  const parsed = JSON.parse(source) as unknown;
  const root = isRecord(parsed) && isRecord(parsed.workflow) ? parsed.workflow : parsed;

  if (!isRecord(root) || !Array.isArray(root.nodes) || !Array.isArray(root.edges)) {
    throw new Error('Import JSON must contain workflow nodes and edges.');
  }

  const nodes = root.nodes.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Node ${index + 1} is invalid.`);
    }

    const nodeType = Object.values(NodeType).find((type) => type === entry.type);
    if (!nodeType) {
      throw new Error(`Node ${index + 1} has an unsupported type.`);
    }

    const position = isRecord(entry.position)
      ? {
          x: typeof entry.position.x === 'number' ? entry.position.x : 80 + index * 220,
          y: typeof entry.position.y === 'number' ? entry.position.y : TEMPLATE_Y,
        }
      : { x: 80 + index * 220, y: TEMPLATE_Y };

    return {
      id: typeof entry.id === 'string' ? entry.id : `imported-node-${index + 1}`,
      type: nodeType,
      position,
      data: sanitizeNodeData(nodeType, entry.data),
    } satisfies WorkflowNode;
  });

  const edges = root.edges.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Edge ${index + 1} is invalid.`);
    }

    if (typeof entry.source !== 'string' || typeof entry.target !== 'string') {
      throw new Error(`Edge ${index + 1} must include source and target.`);
    }

    return {
      id: typeof entry.id === 'string' ? entry.id : `imported-edge-${index + 1}`,
      source: entry.source,
      target: entry.target,
      sourceHandle: typeof entry.sourceHandle === 'string' ? entry.sourceHandle : null,
      targetHandle: typeof entry.targetHandle === 'string' ? entry.targetHandle : null,
      ...(typeof entry.type === 'string' ? { type: entry.type } : {}),
    } satisfies WorkflowEdge;
  });

  return { nodes, edges };
}

export default function App() {
  const { state, selectedNode, selectedNodeHistory, canRedo, canUndo, actions } = useWorkflowState();
  const [automations, setAutomations] = useState<AutomationAction[]>([]);
  const [automationsLoading, setAutomationsLoading] = useState(true);
  const [automationsError, setAutomationsError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('sandbox');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [hasAttemptedSimulation, setHasAttemptedSimulation] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusNodeRequestKey, setFocusNodeRequestKey] = useState(0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const simulationRequest = useMemo<SimulationRequest>(
    () => ({
      workflow: toSerializableWorkflow(state.nodes, state.edges),
    }),
    [state.edges, state.nodes],
  );

  const liveValidation = useMemo(
    () => validateWorkflow(simulationRequest.workflow.nodes, simulationRequest.workflow.edges),
    [simulationRequest],
  );

  const validationErrorsByNode = useMemo(
    () => groupValidationErrorsByNode(liveValidation.errors),
    [liveValidation.errors],
  );
  const showValidationSummary = state.nodes.length > 0 || hasAttemptedSimulation;

  useEffect(() => {
    setCollapsedNodes((current) =>
      Object.fromEntries(
        state.nodes
          .filter((node) => current[node.id])
          .map((node) => [node.id, true]),
      ),
    );
  }, [state.nodes]);

  const handleToggleNodeCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes((current) => ({
      ...current,
      [nodeId]: !current[nodeId],
    }));
  }, []);

  const canvasNodes = useMemo(
    () =>
      state.nodes.map((node) => ({
        ...node,
        dragHandle: '.workflow-node__drag-handle',
        data: {
          ...node.data,
          ui: {
            collapsed: !!collapsedNodes[node.id],
            toggleCollapse: () => handleToggleNodeCollapse(node.id),
            errors: validationErrorsByNode[node.id] ?? [],
            isInvalid: Boolean(validationErrorsByNode[node.id]),
          },
        },
      })),
    [collapsedNodes, handleToggleNodeCollapse, state.nodes, validationErrorsByNode],
  );

  const serializedWorkflow = useMemo(
    () => JSON.stringify(simulationRequest, null, 2),
    [simulationRequest],
  );

  useEffect(() => {
    let isActive = true;

    async function loadAutomations() {
      setAutomationsLoading(true);

      try {
        const actionsList = await getAutomations();
        if (isActive) {
          setAutomations(actionsList);
          setAutomationsError(null);
        }
      } catch {
        if (isActive) {
          setAutomations([]);
          setAutomationsError('Unable to load automation actions right now.');
        }
      } finally {
        if (isActive) {
          setAutomationsLoading(false);
        }
      }
    }

    void loadAutomations();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setSimulationResult(null);
    setSimulationError(null);
  }, [state.edges, state.nodes]);

  useEffect(() => {
    if (!selectedNode && panelMode === 'config') {
      setPanelMode('sandbox');
    }
  }, [panelMode, selectedNode]);

  const handleSelectNode = (nodeId: string | null) => {
    actions.selectNode(nodeId);
    setPanelMode(nodeId ? 'config' : 'sandbox');
  };

  const handleClearWorkflow = () => {
    if (selectedNode) {
      actions.deleteNode(selectedNode.id);
      setPanelMode('sandbox');
      setFocusNodeId(null);
      return;
    }

    actions.clearWorkflow();
    setPanelMode('sandbox');
    setSimulationResult(null);
    setSimulationError(null);
    setHasAttemptedSimulation(false);
    setFocusNodeId(null);
  };

  const handleRunSimulation = async () => {
    setPanelMode('sandbox');
    setSimulationError(null);
    setHasAttemptedSimulation(true);

    if (!liveValidation.isValid) {
      setSimulationResult(null);
      return;
    }

    setIsRunningSimulation(true);

    try {
      const result = await simulateWorkflow(simulationRequest);
      setSimulationResult(result);
    } catch {
      setSimulationResult(null);
      setSimulationError('Simulation failed. Please try again.');
    } finally {
      setIsRunningSimulation(false);
    }
  };

  const handleReviewIssues = () => {
    if (liveValidation.errors.length === 0) {
      return;
    }

    const firstNodeError = liveValidation.errors.find((error) => error.nodeId);
    if (!firstNodeError?.nodeId) {
      setPanelMode('sandbox');
      return;
    }

    setFocusNodeId(firstNodeError.nodeId);
    setFocusNodeRequestKey((current) => current + 1);
    handleSelectNode(firstNodeError.nodeId);
  };

  const handleExportJson = () => {
    const blob = new Blob([serializedWorkflow], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'hr-workflow.json';
    anchor.click();

    window.URL.revokeObjectURL(url);
  };

  const handleOpenImportModal = () => {
    setImportValue('');
    setImportError(null);
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
    setImportError(null);
  };

  const handleImportWorkflow = () => {
    try {
      const workflow = normalizeImportedWorkflow(importValue);
      actions.replaceWorkflow(workflow, 'Imported workflow');
      setPanelMode('sandbox');
      setSimulationResult(null);
      setSimulationError(null);
      handleCloseImportModal();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import workflow JSON.');
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileContents = await file.text();
    setImportValue(fileContents);
    setImportError(null);
  };

  const handleApplyTemplate = (templateId: string) => {
    const nextWorkflow = appendWorkflowTemplate(state, createTemplateWorkflow(templateId));
    actions.replaceWorkflow(nextWorkflow, 'Template added', true);
    setPanelMode('sandbox');
    setSimulationResult(null);
    setSimulationError(null);
    setHasAttemptedSimulation(false);
  };

  const handleAutoArrange = () => {
    actions.replaceWorkflow(autoArrangeWorkflow(state.nodes, state.edges), 'Auto arranged', true);
    setPanelMode('sandbox');
  };

  const handleStartFromScratch = () => {
    const node = createStarterNode(getNextClusterOrigin(state.nodes));
    actions.addNode(node);
    handleSelectNode(node.id);
  };

  const selectedNodeValidation = selectedNode ? validationErrorsByNode[selectedNode.id] ?? [] : [];

  return (
    <>
      <div className="app-shell">
        <Sidebar onApplyTemplate={handleApplyTemplate} />

        <section className="workspace">
          <div className="workspace__header">
            <div>
              <p className="eyebrow">Builder</p>
              <h2>Design workflows visually</h2>
              <p className="workspace__copy">
                Drag steps onto the canvas, connect them, edit the forms, and validate before you run.
              </p>
            </div>
            <Toolbar
              canRedo={canRedo}
              canUndo={canUndo}
              hasSelection={selectedNode !== null}
              hasWorkflow={state.nodes.length > 0}
              isRunning={isRunningSimulation}
              showValidationSummary={showValidationSummary}
              validationErrorCount={liveValidation.errors.length}
              onAutoArrange={handleAutoArrange}
              onClear={handleClearWorkflow}
              onExportJson={handleExportJson}
              onImportJson={handleOpenImportModal}
              onRedo={actions.redo}
              onReviewIssues={handleReviewIssues}
              onRunSimulation={handleRunSimulation}
              onUndo={actions.undo}
            />
          </div>

          <WorkflowCanvas
            actions={actions}
            edges={state.edges}
            focusNodeId={focusNodeId}
            focusNodeRequestKey={focusNodeRequestKey}
            nodes={canvasNodes}
            onStartFromScratch={handleStartFromScratch}
            workflowState={state}
            workflowNodes={state.nodes}
            onSelectNode={handleSelectNode}
          />
        </section>

        <aside className="panel">
          {panelMode === 'config' && selectedNode ? (
            <NodeConfigPanel
              selectedNode={selectedNode}
              nodeHistory={selectedNodeHistory}
              onUpdateNode={actions.updateNode}
              automations={automations}
              automationsError={automationsError}
              automationsLoading={automationsLoading}
              validationErrors={selectedNodeValidation}
            />
          ) : (
            <SandboxPanel
              hasWorkflow={state.nodes.length > 0}
              isRunning={isRunningSimulation}
              onRunSimulation={handleRunSimulation}
              serializedWorkflow={serializedWorkflow}
              showValidationSummary={showValidationSummary}
              simulationError={simulationError}
              simulationResult={simulationResult}
              validationErrors={liveValidation.errors}
            />
          )}
        </aside>
      </div>

      {isImportModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={handleCloseImportModal}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Import</p>
                <h2>Load Workflow JSON</h2>
              </div>
              <button type="button" className="button button--ghost" onClick={handleCloseImportModal}>
                Close
              </button>
            </div>

            <p className="field-hint">
              Paste exported workflow JSON or choose a local file to replace the current canvas.
            </p>

            <label className="field">
              <span>JSON Payload</span>
              <textarea
                className="field-input field-input--textarea modal-card__textarea"
                value={importValue}
                onChange={(event) => setImportValue(event.target.value)}
                placeholder='{"workflow":{"nodes":[],"edges":[]}}'
              />
            </label>

            <label className="field">
              <span>Upload JSON File</span>
              <input type="file" accept=".json,application/json" className="field-input" onChange={handleImportFile} />
            </label>

            {importError ? <p className="field-error">{importError}</p> : null}

            <div className="modal-card__actions">
              <button type="button" className="button button--ghost" onClick={handleCloseImportModal}>
                Cancel
              </button>
              <button
                type="button"
                className="button"
                onClick={handleImportWorkflow}
                disabled={!importValue.trim()}
              >
                Import Workflow
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
