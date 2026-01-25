/**
 * Message list component
 *
 * Scrollable container for messages with auto-scroll behavior
 * and scroll anchoring to prevent viewport jumping during content updates.
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

/** Anchor reference for scroll position preservation */
interface ScrollAnchor {
  element: Element;
  offsetTop: number;
}

/**
 * Scrollable message list with auto-scroll and scroll anchoring
 *
 * Auto-scroll is enabled by default but is suspended when
 * the user scrolls up, resuming when they scroll back to bottom.
 *
 * Scroll anchoring prevents viewport jumping when content changes
 * above the current scroll position (e.g., mermaid diagrams rendering).
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
  const anchorRef = useRef<ScrollAnchor | null>(null);
  const isRestoringAnchorRef = useRef(false);

  // Check if scrolled to bottom
  const isAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const threshold = 50; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Capture anchor before content changes (for viewport stability)
  const captureAnchor = useCallback(() => {
    // Don't capture anchor if at bottom - auto-scroll handles this
    if (isAtBottom()) {
      anchorRef.current = null;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Find topmost visible message element
    const messages = Array.from(container.querySelectorAll('.cortex-message'));
    const containerRect = container.getBoundingClientRect();
    for (const msg of messages) {
      const rect = msg.getBoundingClientRect();
      // Find first message with top edge at or below container top
      if (rect.top >= containerRect.top - 10) {
        anchorRef.current = {
          element: msg,
          offsetTop: rect.top - containerRect.top,
        };
        return;
      }
    }

    anchorRef.current = null;
  }, [isAtBottom]);

  // Restore anchor after content changes
  const restoreAnchor = useCallback(() => {
    const anchor = anchorRef.current;
    const container = containerRef.current;

    if (!anchor || !container || isAutoScrollEnabled) {
      anchorRef.current = null;
      return;
    }

    // Check if the anchor element is still in the DOM
    if (!container.contains(anchor.element)) {
      anchorRef.current = null;
      return;
    }

    const rect = anchor.element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const currentOffset = rect.top - containerRect.top;
    const delta = currentOffset - anchor.offsetTop;

    // Only adjust if there's a meaningful difference (avoids micro-adjustments)
    if (Math.abs(delta) > 2) {
      isRestoringAnchorRef.current = true;
      container.scrollTop += delta;
      // Reset flag after scroll event processes
      requestAnimationFrame(() => {
        isRestoringAnchorRef.current = false;
      });
    }

    anchorRef.current = null;
  }, [isAutoScrollEnabled]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Skip if we're programmatically restoring anchor position
    if (isRestoringAnchorRef.current) return;

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

  // MutationObserver for DOM changes - handles scroll anchoring
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const contentEl = container.querySelector('.cortex-message-list-content');
    if (!contentEl) return;

    const observer = new MutationObserver(() => {
      if (isAutoScrollEnabled) {
        // Auto-scroll to bottom when at bottom
        container.scrollTop = container.scrollHeight;
      } else {
        // Restore anchor position when not at bottom
        restoreAnchor();
      }
    });

    // Capture anchor before mutations
    const captureObserver = new MutationObserver(() => {
      if (!isAutoScrollEnabled) {
        captureAnchor();
      }
    });

    // Capture anchor on attribute/subtree changes that precede content changes
    captureObserver.observe(contentEl, {
      attributes: true,
      subtree: true,
    });

    // Restore anchor after content changes
    observer.observe(contentEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      captureObserver.disconnect();
    };
  }, [isAutoScrollEnabled, restoreAnchor, captureAnchor]);

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
