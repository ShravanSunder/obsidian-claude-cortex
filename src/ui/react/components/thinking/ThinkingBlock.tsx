/**
 * Thinking block component
 *
 * Displays Claude's thinking/reasoning in a collapsible block
 * with optional duration display.
 */

import { useCallback, useState } from 'react';

export interface ThinkingBlockProps {
  /** Thinking content */
  content: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Whether the thinking is still in progress */
  isStreaming?: boolean;
  /** Whether to start collapsed */
  defaultCollapsed?: boolean;
  /** Optional class name */
  className?: string;
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Collapsible thinking block with duration display
 */
export const ThinkingBlock = ({
  content,
  duration,
  isStreaming = false,
  defaultCollapsed = true,
  className,
}: ThinkingBlockProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed && !isStreaming);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const classNames = [
    'cortex-thinking-block',
    isCollapsed && 'cortex-thinking-collapsed',
    isStreaming && 'cortex-thinking-streaming',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      <button type="button" className="cortex-thinking-header" onClick={toggleCollapsed}>
        <span className="cortex-thinking-icon">{isCollapsed ? '▶' : '▼'}</span>
        <span className="cortex-thinking-label">Thinking{isStreaming ? '...' : ''}</span>
        {duration !== undefined && !isStreaming && (
          <span className="cortex-thinking-duration">{formatDuration(duration)}</span>
        )}
      </button>
      {!isCollapsed && (
        <div className="cortex-thinking-content">
          <pre className="cortex-thinking-text">{content}</pre>
          {isStreaming && <span className="cortex-streaming-cursor" />}
        </div>
      )}
    </div>
  );
};
