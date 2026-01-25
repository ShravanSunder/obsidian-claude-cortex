/**
 * Subagent block component
 *
 * Displays a subagent execution with nested tool calls
 * and progress information.
 */

import { useCallback, useState } from 'react';

export type SubagentStatus = 'pending' | 'running' | 'success' | 'error';

export interface SubagentToolCall {
  /** Tool name */
  name: string;
  /** Tool status */
  status: 'pending' | 'running' | 'success' | 'error';
  /** Tool input */
  input?: unknown;
  /** Tool output */
  output?: unknown;
}

export interface SubagentBlockProps {
  /** Subagent description */
  description: string;
  /** Current status */
  status: SubagentStatus;
  /** Nested tool calls */
  toolCalls?: SubagentToolCall[];
  /** Progress message */
  progress?: string;
  /** Final result */
  result?: string;
  /** Whether to start collapsed */
  defaultCollapsed?: boolean;
  /** Optional class name */
  className?: string;
}

/**
 * Get status icon for subagent status
 */
function getStatusIcon(status: SubagentStatus): string {
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
 * Subagent block with nested tool calls
 */
export const SubagentBlock = ({
  description,
  status,
  toolCalls = [],
  progress,
  result,
  defaultCollapsed = false,
  className,
}: SubagentBlockProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const classNames = [
    'cortex-subagent-block',
    `cortex-subagent-${status}`,
    isCollapsed && 'cortex-subagent-collapsed',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const completedCount = toolCalls.filter(
    (t) => t.status === 'success' || t.status === 'error',
  ).length;
  const totalCount = toolCalls.length;

  return (
    <div className={classNames}>
      <button type="button" className="cortex-subagent-header" onClick={toggleCollapsed}>
        <span className={`cortex-subagent-status cortex-subagent-status-${status}`}>
          {getStatusIcon(status)}
        </span>
        <span className="cortex-subagent-description">{description}</span>
        {totalCount > 0 && (
          <span className="cortex-subagent-progress">
            {completedCount}/{totalCount}
          </span>
        )}
        <span className="cortex-subagent-toggle">{isCollapsed ? '▶' : '▼'}</span>
      </button>

      {!isCollapsed && (
        <div className="cortex-subagent-content">
          {progress && status === 'running' && (
            <div className="cortex-subagent-progress-message">{progress}</div>
          )}

          {toolCalls.length > 0 && (
            <div className="cortex-subagent-tools">
              {toolCalls.map((tool, index) => (
                <div
                  key={`${tool.name}-${index}`}
                  className={`cortex-subagent-tool cortex-subagent-tool-${tool.status}`}
                >
                  <span className={`cortex-tool-status cortex-tool-status-${tool.status}`}>
                    {getStatusIcon(tool.status)}
                  </span>
                  <span className="cortex-tool-name">{tool.name}</span>
                </div>
              ))}
            </div>
          )}

          {result && status === 'success' && (
            <div className="cortex-subagent-result">
              <div className="cortex-subagent-result-label">Result</div>
              <div className="cortex-subagent-result-content">{result}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
