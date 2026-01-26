/**
 * Root chat container component
 *
 * Main React component containing the full chat interface.
 * Uses Zustand store for state management - no bridge needed.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';

import type { ChatMessage } from '../../../core/types';
import {
  selectIsStreaming,
  selectStreamingMessage,
  useChatStore,
} from '../../../features/chat/store';
import { Message } from './Message';
import { MessageList } from './MessageList';
import { StreamingMessage } from './StreamingMessage';
import { StreamingMessageLive } from './StreamingMessageLive';

export interface ChatContainerProps {
  /** Optional class name for additional styling */
  className?: string;
}

/**
 * Root container for the React-based chat UI.
 * Renders messages from Zustand store and handles streaming.
 */
export const ChatContainer = ({ className }: ChatContainerProps) => {
  // Subscribe to messages with shallow comparison to prevent infinite loops
  const messages = useChatStore(useShallow((s) => s.messages));
  const isStreaming = useChatStore(selectIsStreaming);
  const streamingMessage = useChatStore(selectStreamingMessage);

  // Filter visible messages with memoization
  const visibleMessages = useMemo(() => messages.filter((msg) => !msg.hidden), [messages]);

  const classNames = ['cortex-react-root', className].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <MessageList autoScroll={true}>
        {/* Render completed messages */}
        {visibleMessages.map((msg) => (
          <MessageContent key={msg.id} message={msg} />
        ))}

        {/* Render streaming message if active - uses live subscription! */}
        {isStreaming && streamingMessage && <StreamingMessageLive message={streamingMessage} />}

        {/* Empty state */}
        {visibleMessages.length === 0 && !isStreaming && (
          <div className="cortex-empty-state">
            <div className="cortex-empty-icon">💬</div>
            <div className="cortex-empty-text">Start a conversation</div>
          </div>
        )}
      </MessageList>
    </div>
  );
};

/**
 * Renders a completed message with all its content blocks
 */
interface MessageContentProps {
  message: ChatMessage;
}

const MessageContent = ({ message }: MessageContentProps) => {
  const timestamp = message.timestamp ? new Date(message.timestamp) : undefined;

  // For user messages, just render the content
  if (message.role === 'user') {
    return (
      <Message role="user" timestamp={timestamp}>
        <div className="cortex-message-text">{message.displayContent || message.content}</div>
        {/* Image attachments */}
        {message.images && message.images.length > 0 && (
          <div className="cortex-message-images">
            {message.images.map((img) => (
              <div key={img.id} className="cortex-image-preview">
                {img.data ? (
                  <img src={`data:${img.mediaType};base64,${img.data}`} alt={img.name} />
                ) : (
                  <div className="cortex-image-placeholder">{img.name}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Message>
    );
  }

  // For assistant messages, use StreamingMessage to parse content into blocks
  return (
    <StreamingMessage
      initialContent={message.content}
      className={message.isPlanMessage ? 'cortex-plan-message' : undefined}
    />
  );
};
