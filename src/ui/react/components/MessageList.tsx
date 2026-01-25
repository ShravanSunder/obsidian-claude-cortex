/**
 * Message list component
 *
 * Scrollable container for messages with auto-scroll behavior.
 */

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface MessageListProps {
  /** Message components to render */
  children: ReactNode;
  /** Whether to auto-scroll to bottom on new content */
  autoScroll?: boolean;
  /** Optional class name */
  className?: string;
  /** Callback when user scrolls */
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
}

/**
 * Scrollable message list with auto-scroll support
 *
 * Auto-scroll is enabled by default but is suspended when
 * the user scrolls up, resuming when they scroll back to bottom.
 */
export const MessageList = ({
  children,
  autoScroll = true,
  className,
  onScroll,
}: MessageListProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);
  const lastScrollTopRef = useRef(0);

  // Check if scrolled to bottom
  const isAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const threshold = 50; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // Detect scroll direction
    const isScrollingDown = scrollTop > lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    // Re-enable auto-scroll if user scrolls to bottom
    if (isAtBottom()) {
      setIsAutoScrollEnabled(true);
    } else if (!isScrollingDown) {
      // Disable auto-scroll if user scrolls up
      setIsAutoScrollEnabled(false);
    }

    onScroll?.(scrollTop, scrollHeight, clientHeight);
  }, [isAtBottom, onScroll]);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (isAutoScrollEnabled && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [children, isAutoScrollEnabled]);

  // Scroll to bottom programmatically
  const scrollToBottom = useCallback((smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant',
      });
      setIsAutoScrollEnabled(true);
    }
  }, []);

  const classNames = ['cortex-message-list', className].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className={classNames} onScroll={handleScroll}>
      <div className="cortex-message-list-content">{children}</div>
      {!isAutoScrollEnabled && (
        <button
          type="button"
          className="cortex-scroll-to-bottom"
          onClick={() => scrollToBottom()}
          aria-label="Scroll to bottom"
        >
          ↓
        </button>
      )}
    </div>
  );
};
