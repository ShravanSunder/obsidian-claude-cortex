/**
 * Tool call block component
 *
 * Displays a tool call with status, input, and output.
 * Supports collapsible details and status indicators.
 */

import { useCallback, useState } from 'react';

export type ToolStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolCallBlockProps {
  /** Tool name */
  name: string;
  /** Tool input (JSON or string) */
  input?: unknown;
  /** Tool output/result */
  output?: unknown;
  /** Current status */
  status: ToolStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Whether to start collapsed */
  defaultCollapsed?: boolean;
  /** Optional class name */
  className?: string;
}

/**
 * Get status icon for tool status
 */
function getStatusIcon(status: ToolStatus): string {
  switch (status) {
    case 'pending':
      return '○';
    case 'running':
      return '◐';
    case 'success':
      return '●';
    case 'error':
      return '✕';
    default:
      return '○';
  }
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Tool call block with collapsible input/output
 */
export const ToolCallBlock = ({
  name,
  input,
  output,
  status,
  error,
  defaultCollapsed = true,
  className,
}: ToolCallBlockProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const classNames = [
    'cortex-tool-call',
    `cortex-tool-${status}`,
    isCollapsed && 'cortex-tool-collapsed',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const formattedInput = formatValue(input);
  const formattedOutput = formatValue(output);

  return (
    <div className={classNames}>
      <button type="button" className="cortex-tool-header" onClick={toggleCollapsed}>
        <span className={`cortex-tool-status cortex-tool-status-${status}`}>
          {getStatusIcon(status)}
        </span>
        <span className="cortex-tool-name">{name}</span>
        <span className="cortex-tool-toggle">{isCollapsed ? '▶' : '▼'}</span>
      </button>

      {!isCollapsed && (
        <div className="cortex-tool-content">
          {formattedInput && (
            <div className="cortex-tool-input">
              <div className="cortex-tool-section-label">Input</div>
              <pre className="cortex-tool-section-content">{formattedInput}</pre>
            </div>
          )}

          {status === 'error' && error && (
            <div className="cortex-tool-error">
              <div className="cortex-tool-section-label">Error</div>
              <pre className="cortex-tool-section-content cortex-tool-error-text">{error}</pre>
            </div>
          )}

          {formattedOutput && status !== 'error' && (
            <div className="cortex-tool-output">
              <div className="cortex-tool-section-label">Output</div>
              <pre className="cortex-tool-section-content">{formattedOutput}</pre>
            </div>
          )}

          {status === 'running' && <div className="cortex-tool-running">Running...</div>}
        </div>
      )}
    </div>
  );
};
