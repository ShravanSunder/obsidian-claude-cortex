/**
 * Message skeleton component
 *
 * Loading placeholder for messages while content is being fetched.
 * Uses animated pulse effect for better UX during loading states.
 */

export interface MessageSkeletonProps {
  /** Number of skeleton lines to show */
  lines?: number;
  /** Whether this is a user message (shorter) or assistant (longer) */
  role?: 'user' | 'assistant';
  /** Optional class name */
  className?: string;
}

/**
 * Skeleton placeholder for a single message
 */
export const MessageSkeleton = ({
  lines = 3,
  role = 'assistant',
  className,
}: MessageSkeletonProps) => {
  const classNames = ['cortex-message-skeleton', `cortex-message-skeleton-${role}`, className]
    .filter(Boolean)
    .join(' ');

  // User messages are typically shorter
  const lineWidths = role === 'user' ? ['60%', '40%'] : ['100%', '85%', '70%', '90%', '50%'];

  return (
    <div className={classNames}>
      <div className="cortex-skeleton-avatar" />
      <div className="cortex-skeleton-content">
        {Array.from({ length: Math.min(lines, lineWidths.length) }, (_, i) => (
          <div key={i} className="cortex-skeleton-line" style={{ width: lineWidths[i] }} />
        ))}
      </div>
    </div>
  );
};

/**
 * Multiple message skeletons for conversation loading
 */
export interface ConversationSkeletonProps {
  /** Number of message skeletons to show */
  count?: number;
  /** Optional class name */
  className?: string;
}

export const ConversationSkeleton = ({ count = 4, className }: ConversationSkeletonProps) => {
  const classNames = ['cortex-conversation-skeleton', className].filter(Boolean).join(' ');

  // Alternate between user and assistant messages
  const messages = Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    lines: i % 2 === 0 ? 2 : 3 + (i % 2),
  }));

  return (
    <div className={classNames}>
      {messages.map((msg, i) => (
        <MessageSkeleton key={i} role={msg.role as 'user' | 'assistant'} lines={msg.lines} />
      ))}
    </div>
  );
};
