interface ToolbarProps {
  canRedo: boolean;
  canUndo: boolean;
  hasWorkflow: boolean;
  hasSelection: boolean;
  isRunning: boolean;
  showValidationSummary: boolean;
  validationErrorCount: number;
  onAutoArrange: () => void;
  onClear: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onRedo: () => void;
  onReviewIssues: () => void;
  onRunSimulation: () => void;
  onUndo: () => void;
}

export function Toolbar({
  canRedo,
  canUndo,
  hasSelection,
  hasWorkflow,
  isRunning,
  showValidationSummary,
  validationErrorCount,
  onAutoArrange,
  onClear,
  onExportJson,
  onImportJson,
  onRedo,
  onReviewIssues,
  onRunSimulation,
  onUndo,
}: ToolbarProps) {
  const validationLabel = !showValidationSummary
    ? 'No workflow yet'
    : validationErrorCount > 0
      ? `${validationErrorCount} issue${validationErrorCount === 1 ? '' : 's'}`
      : 'Ready';
  const clearLabel = hasSelection ? 'Delete Selected' : 'Clear Workflow';

  return (
    <div className="toolbar">
      <div className="toolbar__group">
        <button
          type="button"
          className={`validation-pill validation-pill--button${showValidationSummary && validationErrorCount > 0 ? ' validation-pill--error' : ''}${!showValidationSummary ? ' validation-pill--idle' : ''}`}
          onClick={onReviewIssues}
          disabled={validationErrorCount === 0 || !showValidationSummary}
          title={validationErrorCount > 0 ? 'Click to jump to first issue' : undefined}
        >
          {validationLabel}
        </button>
      </div>

      <div className="toolbar__group">
        <button type="button" className="button button--ghost" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="button button--ghost" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
      </div>

      <div className="toolbar__group">
        <button type="button" className="button button--ghost" onClick={onAutoArrange}>
          Auto Arrange
        </button>
      </div>

      <div className="toolbar__group">
        <button type="button" className="button button--ghost" onClick={onImportJson}>
          Import JSON
        </button>
        <button type="button" className="button button--ghost" onClick={onExportJson}>
          Export JSON
        </button>
      </div>

      <div className="toolbar__group">
        <button
          type="button"
          className="button button--ghost button--danger"
          onClick={onClear}
          disabled={!hasWorkflow}
          title={
            !hasWorkflow
              ? undefined
              : hasSelection
                ? 'Delete the selected node'
                : 'Clear the entire workflow'
          }
        >
          {clearLabel}
        </button>
        <button
          type="button"
          className="button"
          onClick={onRunSimulation}
          disabled={isRunning || !hasWorkflow}
          title={!hasWorkflow ? 'Add at least one node to simulate' : undefined}
          aria-label={!hasWorkflow ? 'Add at least one node to simulate' : 'Run Simulation'}
        >
          {isRunning ? 'Running...' : 'Run Simulation'}
        </button>
      </div>
    </div>
  );
}
