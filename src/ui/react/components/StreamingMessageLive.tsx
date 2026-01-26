/**
 * Live streaming message component
 *
 * Subscribes to Zustand store for real-time streaming updates.
 * This is the key fix - React components auto-update as text streams in.
 */

import { useEffect, useMemo, useRef } from 'react';

import type { ChatMessage, ContentBlock } from '../../../core/types';
import { useChatStore } from '../../../features/chat/store';
import { useStreamingParser } from '../hooks/useStreamingParser';
import { StreamingMarkdownParser } from '../parser';
import { BlockRenderer } from './blocks';

export interface StreamingMessageLiveProps {
  /** The streaming message being built */
  message: ChatMessage;
  /** Source path for link resolution */
  sourcePath?: string;
  /** Optional class name */
  className?: string;
}

/**
 * Renders a message that's actively streaming, subscribing to store updates.
 *
 * This component:
 * 1. Renders finalized content blocks from the message
 * 2. Subscribes to streaming.textContent for live text updates
 * 3. Subscribes to streaming.thinkingContent for live thinking updates
 */
export const StreamingMessageLive = ({
  message,
  sourcePath,
  className,
}: StreamingMessageLiveProps) => {
  // Subscribe to streaming content - updates on every chunk!
  const streamingText = useChatStore((s) => s.streaming.textContent);
  const streamingThinking = useChatStore((s) => s.streaming.thinkingContent);

  // Use the streaming parser for the current text content
  const { blocks, push, reset } = useStreamingParser();
  const lastPushedLengthRef = useRef(0);

  // Push ONLY new content incrementally (not entire text on every chunk)
  useEffect(() => {
    if (!streamingText) {
      // Reset when streaming stops
      if (lastPushedLengthRef.current > 0) {
        reset();
        lastPushedLengthRef.current = 0;
      }
      return;
    }

    // Only push new characters, not the entire text
    const newContent = streamingText.slice(lastPushedLengthRef.current);
    if (newContent) {
      push(newContent);
      lastPushedLengthRef.current = streamingText.length;
    }
  }, [streamingText, push, reset]);

  const classNames = [
    'cortex-message',
    'cortex-message-assistant',
    'cortex-streaming-active',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Render finalized content blocks from the message
  const finalizedBlocks = message.contentBlocks || [];

  return (
    <div className={classNames} data-role="assistant">
      <div className="cortex-message-content">
        <div className="cortex-message-blocks">
          {/* Render finalized blocks */}
          {finalizedBlocks.map((block, index) => (
            <FinalizedBlockRenderer
              key={`finalized-${index}`}
              block={block}
              sourcePath={sourcePath}
            />
          ))}

          {/* Render current streaming thinking */}
          {streamingThinking && (
            <div className="cortex-thinking-block cortex-thinking-streaming">
              <div className="cortex-thinking-header">
                <span className="cortex-thinking-label">Thinking...</span>
              </div>
              <div className="cortex-thinking-content">
                <span className="cortex-thinking-text">{streamingThinking}</span>
                <span className="cortex-streaming-cursor" />
              </div>
            </div>
          )}

          {/* Render current streaming text via parser blocks */}
          {blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} sourcePath={sourcePath} />
          ))}

          {/* Show placeholder if nothing yet */}
          {finalizedBlocks.length === 0 && blocks.length === 0 && !streamingThinking && (
            <div className="cortex-message-placeholder">...</div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Renders a finalized content block from the message
 */
interface FinalizedBlockRendererProps {
  block: ContentBlock;
  sourcePath?: string;
}

const FinalizedBlockRenderer = ({ block, sourcePath }: FinalizedBlockRendererProps) => {
  // For text blocks, parse once and render (no streaming parser needed)
  const parsedBlocks = useMemo(() => {
    if (block.type !== 'text') return [];
    const parser = new StreamingMarkdownParser();
    parser.push(block.content);
    parser.end();
    return parser.getAllBlocks();
  }, [block.type, block.type === 'text' ? block.content : '']);

  switch (block.type) {
    case 'text':
      return (
        <>
          {parsedBlocks.map((b) => (
            <BlockRenderer key={b.id} block={b} sourcePath={sourcePath} />
          ))}
        </>
      );

    case 'thinking':
      return (
        <div className="cortex-thinking-block">
          <div className="cortex-thinking-header">
            <span className="cortex-thinking-label">
              Thought for {block.durationSeconds?.toFixed(1)}s
            </span>
          </div>
          <div className="cortex-thinking-content">
            <span className="cortex-thinking-text">{block.content}</span>
          </div>
        </div>
      );

    case 'tool_use':
      // Tool blocks are rendered separately via toolCalls
      return null;

    case 'subagent':
      // Subagent blocks are rendered separately via subagents
      return null;

    default:
      return null;
  }
};
