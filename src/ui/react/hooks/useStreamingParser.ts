/**
 * Hook for streaming markdown parsing
 *
 * Provides React integration for the StreamingMarkdownParser,
 * managing block state during streaming.
 */

import { useCallback, useRef, useState } from 'react';
import { type Block, type BlockEvent, StreamingMarkdownParser } from '../parser';

/**
 * Result of the useStreamingParser hook
 */
export interface UseStreamingParserResult {
  /** Current blocks (including streaming) */
  blocks: Block[];
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Push new content chunk */
  push: (chunk: string) => BlockEvent[];
  /** Signal end of stream */
  end: () => BlockEvent[];
  /** Reset parser state */
  reset: () => void;
}

/**
 * Hook that provides streaming markdown parsing with React state management
 *
 * @returns Object with blocks, streaming state, and control functions
 *
 * @example
 * ```tsx
 * const StreamingMessage = ({ stream$ }) => {
 *   const { blocks, push, end, reset } = useStreamingParser();
 *
 *   useEffect(() => {
 *     const sub = stream$.subscribe({
 *       next: (chunk) => push(chunk),
 *       complete: () => end(),
 *     });
 *     return () => sub.unsubscribe();
 *   }, [stream$, push, end]);
 *
 *   return <>{blocks.map(b => <BlockRenderer key={b.id} block={b} />)}</>;
 * };
 * ```
 */
export function useStreamingParser(): UseStreamingParserResult {
  const parserRef = useRef(new StreamingMarkdownParser());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const updateBlocks = useCallback(() => {
    setBlocks(parserRef.current.getAllBlocks());
  }, []);

  const push = useCallback(
    (chunk: string): BlockEvent[] => {
      setIsStreaming(true); // React will skip if unchanged
      const events = parserRef.current.push(chunk);
      updateBlocks();
      return events;
    },
    [updateBlocks],
  );

  const end = useCallback((): BlockEvent[] => {
    const events = parserRef.current.end();
    setIsStreaming(false);
    updateBlocks();
    return events;
  }, [updateBlocks]);

  const reset = useCallback(() => {
    parserRef.current.reset();
    setBlocks([]);
    setIsStreaming(false);
  }, []);

  return {
    blocks,
    isStreaming,
    push,
    end,
    reset,
  };
}
