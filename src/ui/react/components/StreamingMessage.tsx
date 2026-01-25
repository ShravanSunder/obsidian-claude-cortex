/**
 * Streaming message component
 *
 * Handles rendering of assistant messages during streaming,
 * integrating the parser with block rendering.
 */

import { useEffect, useRef } from 'react';
import { useStreamingParser } from '../hooks/useStreamingParser';
import { BlockRenderer } from './blocks';
import { Message } from './Message';

export interface StreamingMessageProps {
  /** Initial content (for non-streaming messages) */
  initialContent?: string;
  /** Source path for link resolution */
  sourcePath?: string;
  /** Optional class name */
  className?: string;
  /** Callback when streaming starts */
  onStreamStart?: () => void;
  /** Callback when streaming ends */
  onStreamEnd?: () => void;
}

/**
 * Renders an assistant message with streaming support
 *
 * Can be used in two modes:
 * 1. Static: Pass initialContent for pre-rendered messages
 * 2. Streaming: Use the ref handle to push chunks
 */
export interface StreamingMessageHandle {
  /** Push a text chunk to the stream */
  push: (chunk: string) => void;
  /** Signal end of stream */
  end: () => void;
  /** Reset for a new message */
  reset: () => void;
}

export const StreamingMessage = ({
  initialContent,
  sourcePath,
  className,
  onStreamStart,
  onStreamEnd,
}: StreamingMessageProps) => {
  const { blocks, isStreaming, push, end, reset } = useStreamingParser();
  const hasStartedRef = useRef(false);
  const handleRef = useRef<StreamingMessageHandle>({
    push: (chunk: string) => {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        onStreamStart?.();
      }
      push(chunk);
    },
    end: () => {
      end();
      hasStartedRef.current = false;
      onStreamEnd?.();
    },
    reset: () => {
      reset();
      hasStartedRef.current = false;
    },
  });

  // Parse initial content if provided
  useEffect(() => {
    if (initialContent) {
      push(initialContent);
      end();
    }
  }, [initialContent, push, end]);

  // Expose handle via data attribute for imperative access
  useEffect(() => {
    // Store handle on window for imperative access if needed
    // This is a workaround for React's forward ref limitations with hooks
    (window as unknown as Record<string, unknown>).__streamingMessageHandle = handleRef.current;
    return () => {
      delete (window as unknown as Record<string, unknown>).__streamingMessageHandle;
    };
  }, []);

  const classNames = [
    'cortex-streaming-message',
    isStreaming && 'cortex-streaming-active',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Message role="assistant" className={classNames}>
      <div className="cortex-message-blocks">
        {blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} sourcePath={sourcePath} />
        ))}
      </div>
      {isStreaming && blocks.length === 0 && <div className="cortex-message-placeholder">...</div>}
    </Message>
  );
};

// Export handle type for external use
export type { StreamingMessageHandle as StreamingMessageRef };
