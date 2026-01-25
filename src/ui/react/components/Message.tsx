/**
 * Message component
 *
 * Wrapper for displaying a single message (user or assistant)
 * with role-specific styling.
 */

import type { ReactNode } from 'react';

export type MessageRole = 'user' | 'assistant';

export interface MessageProps {
  /** Role of the message sender */
  role: MessageRole;
  /** Message content */
  children: ReactNode;
  /** Optional class name */
  className?: string;
  /** Optional message timestamp */
  timestamp?: Date;
}

/**
 * Displays a single message with role-appropriate styling
 */
export const Message = ({ role, children, className, timestamp }: MessageProps) => {
  const classNames = ['cortex-message', `cortex-message-${role}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} data-role={role}>
      <div className="cortex-message-content">{children}</div>
      {timestamp && (
        <div className="cortex-message-timestamp">
          {timestamp.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </div>
  );
};
