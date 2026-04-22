import type { Edge, Node, XYPosition } from '@xyflow/react';

export enum NodeType {
  START = 'start',
  TASK = 'task',
  APPROVAL = 'approval',
  AUTOMATED_STEP = 'automated_step',
  END = 'end',
}

export interface StartData {
  title: string;
  metadata?: Record<string, string>;
}

export interface TaskData {
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  customFields?: Record<string, string>;
}

export interface ApprovalData {
  title: string;
  approverRole: 'Manager' | 'HRBP' | 'Director';
  autoApproveThreshold: number;
}

export interface AutomatedStepData {
  title: string;
  actionId: string;
  parameters: Record<string, string>;
}

export interface EndData {
  endMessage: string;
  summaryFlag: boolean;
}

export interface NodeUiState {
  errors?: string[];
  isInvalid?: boolean;
  collapsed?: boolean;
  toggleCollapse?: () => void;
}

type NodePayload =
  | { nodeType: NodeType.START; config: StartData }
  | { nodeType: NodeType.TASK; config: TaskData }
  | { nodeType: NodeType.APPROVAL; config: ApprovalData }
  | { nodeType: NodeType.AUTOMATED_STEP; config: AutomatedStepData }
  | { nodeType: NodeType.END; config: EndData };

export type NodeData = NodePayload & {
  ui?: NodeUiState;
};

export interface WorkflowNode extends Node<NodeData, NodeType> {
  id: string;
  type: NodeType;
  position: XYPosition;
  data: NodeData;
}

export interface WorkflowEdge extends Edge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeHistory: Record<string, NodeVersionEntry[]>;
  selectedNodeId: string | null;
}

export interface AutomationAction {
  id: string;
  label: string;
  params: string[];
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface NodeVersionEntry {
  id: string;
  timestamp: string;
  label: string;
  data: NodeData;
}

export interface SimulationRequest {
  workflow: WorkflowDefinition;
}

export interface SimulationStep {
  stepNumber: number;
  nodeId: string;
  nodeType: NodeType;
  action: string;
  status: 'completed';
  timestamp: string;
}

export interface SimulationResult {
  success: true;
  steps: SimulationStep[];
  totalDuration: number;
  summary: string;
}
