import type { NodeTypes } from '@xyflow/react';

import { NodeType } from '../types';
import { ApprovalNode } from './ApprovalNode';
import { AutomatedStepNode } from './AutomatedStepNode';
import { BaseNode } from './BaseNode';
import { EndNode } from './EndNode';
import { StartNode } from './StartNode';
import { TaskNode } from './TaskNode';

export const workflowNodeTypes: NodeTypes = {
  [NodeType.START]: StartNode,
  [NodeType.TASK]: TaskNode,
  [NodeType.APPROVAL]: ApprovalNode,
  [NodeType.AUTOMATED_STEP]: AutomatedStepNode,
  [NodeType.END]: EndNode,
};

export { ApprovalNode, AutomatedStepNode, BaseNode, EndNode, StartNode, TaskNode };
