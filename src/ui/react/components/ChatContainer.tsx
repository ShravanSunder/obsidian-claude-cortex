/**
 * Root chat container component
 *
 * Main React component containing the full chat interface.
 * Connects the ChatBridge to React context and renders messages.
 */

import { useEffect, useMemo } from 'react';
import type { ChatMessage } from '../../../core/types';
import type { ChatBridge } from '../bridge/ChatBridge';
import { useChatContext } from '../context/ChatContext';
import { Message } from './Message';
import { MessageList } from './MessageList';
import { StreamingMessage } from './StreamingMessage';

export interface ChatContainerProps {
  /** Bridge for connecting imperative state updates */
  chatBridge?: ChatBridge;
  /** Optional class name for additional styling */
  className?: string;
}

/**
 * Root container for the React-based chat UI.
 * Renders messages from context and handles streaming.
 */
export const ChatContainer = ({ chatBridge, className }: ChatContainerProps) => {
  const { state, dispatch } = useChatContext();

  // Connect bridge to dispatch when mounted
  useEffect(() => {
    if (chatBridge) {
      chatBridge.connect(dispatch);
      return () => chatBridge.disconnect();
    }
  }, [chatBridge, dispatch]);

  // Memoize visible messages (filter hidden ones)
  const visibleMessages = useMemo(
    () => state.messages.filter((msg) => !msg.hidden),
    [state.messages],
  );

  const classNames = ['cortex-react-root', className].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <MessageList autoScroll={state.autoScrollEnabled}>
        {/* Render completed messages */}
        {visibleMessages.map((msg) => (
          <MessageContent key={msg.id} message={msg} />
        ))}

        {/* Render streaming message if active */}
        {state.isStreaming && state.currentStreamingMessage && (
          <StreamingMessageFromChat message={state.currentStreamingMessage} />
        )}

        {/* Empty state */}
        {visibleMessages.length === 0 && !state.isStreaming && (
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

/**
 * Renders a streaming message that's currently being built
 */
interface StreamingMessageFromChatProps {
  message: ChatMessage;
}

const StreamingMessageFromChat = ({ message }: StreamingMessageFromChatProps) => {
  // Use StreamingMessage with the current content
  // The streaming message component handles parsing and block rendering
  return <StreamingMessage initialContent={message.content} className="cortex-streaming-active" />;
};
