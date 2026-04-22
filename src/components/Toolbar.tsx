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
    ? '0 Errors'
    : validationErrorCount > 0
      ? `${validationErrorCount} Error${validationErrorCount === 1 ? '' : 's'}`
      : '0 Errors';
  const clearLabel = hasSelection ? 'Delete Selected' : 'Clear';

  return (
    <div className="toolbar">
      <div className="toolbar__group toolbar__group--icons">
        <button
          type="button"
          className="toolbar-icon-button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          ↶
        </button>
        <button
          type="button"
          className="toolbar-icon-button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          ↷
        </button>
        <button
          type="button"
          className="toolbar-icon-button"
          onClick={onAutoArrange}
          aria-label="Auto arrange"
          title="Auto Arrange"
        >
          ⤧
        </button>
      </div>

      <div className="toolbar__group toolbar__group--files">
        <button type="button" className="button button--ghost toolbar-button--compact" onClick={onImportJson}>
          Import
        </button>
        <button type="button" className="button button--ghost toolbar-button--compact" onClick={onExportJson}>
          Export
        </button>
      </div>

      <div className="toolbar__group toolbar__group--status">
        <button
          type="button"
          className={`validation-pill validation-pill--button${showValidationSummary && validationErrorCount > 0 ? ' validation-pill--error' : ''}${!showValidationSummary ? ' validation-pill--idle' : ''}`}
          onClick={onReviewIssues}
          disabled={!showValidationSummary}
          title={validationErrorCount > 0 ? 'Click to jump to first issue' : undefined}
        >
          {validationLabel}
        </button>
      </div>

      <div className="toolbar__group">
        <button
          type="button"
          className="button button--ghost button--danger toolbar-button--compact"
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
          className="button toolbar-button--primary"
          onClick={onRunSimulation}
          disabled={isRunning || !hasWorkflow}
          title={!hasWorkflow ? 'Add at least one node to simulate' : undefined}
          aria-label={!hasWorkflow ? 'Add at least one node to simulate' : 'Run Simulation'}
        >
          {isRunning ? 'Running...' : 'Simulate'}
        </button>
      </div>
    </div>
  );
}
