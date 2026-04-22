# HR Workflow Designer

## Short Description

This is a small React + TypeScript + Vite prototype for designing and testing HR workflows like onboarding, leave approval, and document verification. The goal was to build something clean, modular, and working within the case-study time box rather than over-engineer it.

Live demo: [https://gursimarsingh-hr-workflow-designer.netlify.app](https://gursimarsingh-hr-workflow-designer.netlify.app)

## Tech Stack

- React 19
- TypeScript
- Vite
- React Flow via `@xyflow/react`
- Vitest for focused validation and simulation tests

## Features Completed

- Three-panel workflow builder layout with sidebar, canvas, and right-side panel
- 5 required node types:
  `Start`, `Task`, `Approval`, `Automated Step`, and `End`
- Drag and drop node creation on the React Flow canvas
- Edge creation, edge deletion, and node deletion
- Node selection with node-specific configuration forms
- Dynamic automated-step parameters based on mock automation actions
- Live workflow validation for structure and required fields
- Mock `GET /automations` and `POST /simulate` style API behavior
- Sandbox panel with validation summary, workflow JSON preview, and execution logs
- Deterministic workflow simulation for stable execution ordering

## Bonus Features Completed

- Quick HR templates:
  `Employee Onboarding`, `Leave Approval`, and `Document Verification`
- Node-level validation highlights directly on the canvas
- Undo / Redo
- Auto Arrange
- Export / Import JSON
- Copy JSON action
- Node edit version history
- Focus-to-issue behavior from the validation badge
- Targeted automated tests for validation and simulation logic

## Folder Structure

```text
src/
  App.tsx
  main.tsx
  index.css
  components/
  nodes/
  panels/
  hooks/
  services/
  types/
  utils/
```

- `src/App.tsx` orchestrates layout, panel switching, validation state, and simulation flow.
- `src/components` holds the sidebar, toolbar, and React Flow canvas wrapper.
- `src/nodes` contains the custom node components and shared node shell.
- `src/panels` contains the configuration panel and sandbox panel.
- `src/hooks/useWorkflowState.ts` owns reducer-based workflow state, history, and undo/redo.
- `src/services/mockApi.ts` contains mock automation and simulation services.
- `src/types/workflow.ts` defines workflow, simulation, and history types.
- `src/utils/validators.ts` contains workflow validation rules and node error grouping.

## Architecture

I kept the architecture simple on purpose.

- `App.tsx` handles the main layout, panel switching, template actions, import/export, and simulation flow.
- `WorkflowCanvas.tsx` contains the React Flow-specific behavior like drag/drop, connecting nodes, node placement, and canvas interactions.
- `useWorkflowState.ts` is the central reducer for workflow state, undo/redo, and selected-node state.
- `NodeConfigPanel.tsx` handles the editable forms for each node type.
- `SandboxPanel.tsx` handles validation feedback, serialized workflow JSON, and simulation results.
- `mockApi.ts` contains the lightweight mock API layer for `/automations` and `/simulate`.
- `validators.ts` keeps workflow validation logic separate from the UI so it is easier to test and extend.

## How To Run

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173/
```

Create a production build:

```bash
npm run build
```

Run the tests:

```bash
npm test
```

## Design Decisions

- I used React Flow because the case study is clearly about graph-based workflow design, and it gives solid canvas behavior without spending time reinventing that part.
- I kept workflow state in a reducer so node edits, canvas actions, undo/redo, and simulation all read from the same source of truth.
- I separated canvas logic, validation logic, mock API logic, and form logic so the code stays understandable even as the feature set grows.
- I kept the folder structure modular, but not too "enterprise." For a short case study, I wanted the codebase to stay easy to read.
- I treated simulation as a serialized workflow request so it feels close to a real API interaction even though this is still a frontend-only prototype.
- I added node-level validation so problems are visible directly on the canvas, not only in the right panel.
- For the MVP, I kept `Approval` as a simple workflow step instead of introducing explicit approved/rejected routing logic.
- The mock automation list is intentionally small and fixed to `send_email` and `generate_doc`, which felt like the right scope for this assignment.

## Tradeoffs / Assumptions

- This is a frontend-only prototype, so there is no auth, backend persistence, or database layer.
- Local mock services are enough for this case study, so I did not introduce JSON server or MSW just for the sake of extra setup.
- Validation focuses on workflow structure and required fields, not full real-world business rules.
- Some graph behaviors are intentionally simple because the assignment is time-boxed and the priority is working functionality with clean structure.
- `Task.dueDate` is optional in state and stays empty when not set. If a stricter backend is introduced later, I would normalize it at the API boundary instead of spreading that logic across the form layer.

## What I Completed vs. What I'd Add With More Time

Completed in this prototype:

- core workflow canvas with the 5 required node types
- node editing forms for every required node
- mock automations and mock simulation flow
- validation, sandbox/testing panel, and README
- a few bonus features like templates, undo/redo, import/export, auto arrange, and node-level validation

If I had more time, I would focus next on:

- full browser E2E coverage for drag/drop, import/export, and undo/redo flows
- smoother handling for more complex branched workflows
- better layout heuristics for larger branched workflows
- visual edge-level validation cues
- optional persistence or save/load beyond manual JSON import/export
- sharable workflow snapshots or exports beyond JSON
- more advanced workflow semantics for approvals and conditional routing
