import { useState } from 'react';

import type { SimulationResult } from '../types';
import type { ValidationError } from '../utils';

interface SandboxPanelProps {
  hasWorkflow: boolean;
  isRunning: boolean;
  onRunSimulation: () => void;
  serializedWorkflow: string;
  showValidationSummary: boolean;
  simulationError: string | null;
  simulationResult: SimulationResult | null;
  validationErrors: ValidationError[];
}

export function SandboxPanel({
  hasWorkflow,
  isRunning,
  onRunSimulation,
  serializedWorkflow,
  showValidationSummary,
  simulationError,
  simulationResult,
  validationErrors,
}: SandboxPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(serializedWorkflow);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('error');
    }
  };

  return (
    <div className="panel-card">
      <div className="panel-card__header">
        <p className="eyebrow">Sandbox</p>
        <h2>Validation and Simulation</h2>
      </div>

      <div
        className={`status-card${showValidationSummary && validationErrors.length > 0 ? ' status-card--error' : ''}`}
      >
        <h3>Validation Summary</h3>
        {!showValidationSummary ? (
          <div className="empty-state-card">
            <div className="empty-state-card__icon">i</div>
            <div>
              <strong>Add steps to begin validation</strong>
              <p className="field-hint">Build a workflow to see validation feedback.</p>
            </div>
          </div>
        ) : validationErrors.length > 0 ? (
          <>
            <p className="field-hint">
              {validationErrors.length} validation issue{validationErrors.length === 1 ? '' : 's'} detected.
            </p>
            <ul className="status-list">
              {validationErrors.map((error) => (
                <li key={error.nodeId ? `${error.nodeId}-${error.message}` : error.message}>{error.message}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="field-hint">Workflow structure is valid and ready to simulate.</p>
        )}
      </div>

      <div className="status-card">
        <h3>Run Simulation</h3>
        <p className="field-hint">
          Serialize the current workflow graph and send it through the mock <code>/simulate</code> flow.
        </p>
        {!hasWorkflow ? <p className="field-hint">Add at least one node to enable simulation.</p> : null}
        <button
          type="button"
          className="button sandbox-run"
          onClick={onRunSimulation}
          disabled={isRunning || !hasWorkflow}
          title={!hasWorkflow ? 'Add at least one node to simulate' : undefined}
          aria-label={!hasWorkflow ? 'Add at least one node to simulate' : 'Run Simulation'}
        >
          {isRunning ? 'Running Simulation...' : 'Run Simulation'}
        </button>
      </div>

      {simulationError ? (
        <div className="status-card status-card--error">
          <h3>Simulation Error</h3>
          <p className="field-hint">{simulationError}</p>
        </div>
      ) : null}

      {simulationResult ? (
        <div className="status-card">
          <h3>Execution Summary</h3>
          <div className="summary-grid">
            <div>
              <span>Status</span>
              <strong>{simulationResult.success ? 'Success' : 'Failed'}</strong>
            </div>
            <div>
              <span>Steps</span>
              <strong>{simulationResult.steps.length}</strong>
            </div>
            <div>
              <span>Duration</span>
              <strong>{simulationResult.totalDuration}ms</strong>
            </div>
          </div>
          <p className="field-hint">{simulationResult.summary}</p>
        </div>
      ) : null}

      <div className="status-card">
        <div className="status-card__actions">
          <div>
            <h3>Serialized Workflow JSON</h3>
            <p className="field-hint">{hasWorkflow ? 'Current workflow snapshot' : 'No workflow data yet'}</p>
          </div>
          <button type="button" className="button button--ghost" onClick={handleCopyJson}>
            {copyState === 'copied' ? 'Copied' : 'Copy JSON'}
          </button>
        </div>
        {copyState === 'error' ? <p className="field-error">Unable to copy JSON right now.</p> : null}
        <pre className={`payload-preview${!hasWorkflow ? ' payload-preview--compact' : ''}`}>
          {serializedWorkflow}
        </pre>
      </div>

      <div className="log-panel">
        {simulationResult ? (
          simulationResult.steps.map((step) => (
            <div key={step.nodeId} className="log-row">
              <div className="log-row__number">#{step.stepNumber}</div>
              <div className="log-row__content">
                <strong>{step.action}</strong>
                <span>{step.timestamp}</span>
              </div>
              <span className="log-row__status">{step.status}</span>
            </div>
          ))
        ) : (
          <div className="status-card">
            <h3>Execution Logs</h3>
            <div className="empty-state-card">
              <div className="empty-state-card__icon">{hasWorkflow ? '>' : '...'}</div>
              <div>
                <strong>No execution yet</strong>
                <p className="field-hint">
                  {hasWorkflow
                    ? 'Run simulation after building a valid workflow.'
                    : 'Create a workflow first, then run simulation to see the execution timeline.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
