/**
 * Conversation loader component with Suspense support
 *
 * Provides a Suspense boundary for lazy loading conversations.
 * Shows skeleton while conversation data is being fetched.
 */

import { Suspense, use, useMemo } from 'react';
import type { Conversation } from '../../../core/types';
import { ChatContainer, type ChatContainerProps } from './ChatContainer';
import { ConversationSkeleton } from './skeletons/MessageSkeleton';

export interface ConversationLoaderProps extends Omit<ChatContainerProps, 'children'> {
  /** Promise that resolves to a conversation */
  conversationPromise: Promise<Conversation | null>;
  /** Fallback to show while loading */
  fallback?: React.ReactNode;
}

/**
 * Wraps ChatContainer with Suspense for lazy loading
 *
 * Usage:
 * ```tsx
 * const promise = useMemo(() => loadConversation(id), [id]);
 * <ConversationLoader conversationPromise={promise} chatBridge={bridge} />
 * ```
 */
export const ConversationLoader = ({
  conversationPromise,
  fallback,
  ...chatContainerProps
}: ConversationLoaderProps) => {
  return (
    <Suspense fallback={fallback ?? <ConversationSkeleton count={4} />}>
      <ConversationContent conversationPromise={conversationPromise} {...chatContainerProps} />
    </Suspense>
  );
};

/**
 * Internal component that uses React's `use` hook to await the promise
 */
interface ConversationContentProps extends Omit<ChatContainerProps, 'children'> {
  conversationPromise: Promise<Conversation | null>;
}

const ConversationContent = ({
  conversationPromise,
  ...chatContainerProps
}: ConversationContentProps) => {
  // React 19's `use` hook unwraps the promise with Suspense
  const conversation = use(conversationPromise);

  // Handle case where conversation wasn't found
  if (!conversation) {
    return (
      <div className="cortex-empty-state">
        <div className="cortex-empty-icon">404</div>
        <div className="cortex-empty-text">Conversation not found</div>
      </div>
    );
  }

  return <ChatContainer {...chatContainerProps} />;
};

/**
 * Hook to create a stable conversation loading promise
 *
 * Memoizes the promise based on conversation ID to prevent
 * unnecessary re-fetching during re-renders.
 */
export function useConversationPromise(
  conversationId: string | null,
  loadFn: (id: string) => Promise<Conversation | null>,
): Promise<Conversation | null> {
  return useMemo(() => {
    if (!conversationId) {
      return Promise.resolve(null);
    }
    return loadFn(conversationId);
  }, [conversationId, loadFn]);
}
