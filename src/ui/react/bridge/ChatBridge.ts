/**
 * Bridge between vanilla ChatState and React context
 *
 * This class allows imperative code (controllers, event handlers) to
 * trigger React state updates without directly accessing React internals.
 */

import type { Dispatch } from 'react';
import type { ChatMessage, UsageInfo } from '../../../core/types';
import type { ChatAction } from '../context/ChatContext';

/**
 * Bridge class that connects imperative ChatState updates to React.
 *
 * Usage:
 * 1. Create a ChatBridge instance in CortexView
 * 2. Pass it to ChatProvider which calls bridge.connect(dispatch)
 * 3. Controllers call bridge methods to trigger React updates
 * 4. On unmount, ChatProvider calls bridge.disconnect()
 */
export class ChatBridge {
  private dispatch: Dispatch<ChatAction> | null = null;
  private listeners: Set<() => void> = new Set();

  /**
   * Connect the bridge to React dispatch.
   * Called by ChatProvider when it mounts.
   */
  connect(dispatch: Dispatch<ChatAction>): void {
    this.dispatch = dispatch;
  }

  /**
   * Disconnect the bridge from React.
   * Called by ChatProvider when it unmounts.
   */
  disconnect(): void {
    this.dispatch = null;
  }

  /**
   * Check if bridge is connected to React.
   */
  isConnected(): boolean {
    return this.dispatch !== null;
  }

  /**
   * Add a listener for bridge events (e.g., for scroll management).
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  // ========== Message Management ==========

  /**
   * Set all messages (e.g., when loading a conversation).
   */
  setMessages(messages: ChatMessage[]): void {
    this.dispatch?.({ type: 'SET_MESSAGES', messages });
    this.notifyListeners();
  }

  /**
   * Add a single message to the list.
   */
  addMessage(message: ChatMessage): void {
    this.dispatch?.({ type: 'ADD_MESSAGE', message });
    this.notifyListeners();
  }

  /**
   * Clear all messages.
   */
  clearMessages(): void {
    this.dispatch?.({ type: 'CLEAR_MESSAGES' });
    this.notifyListeners();
  }

  // ========== Streaming State ==========

  /**
   * Set the streaming state.
   */
  setStreaming(isStreaming: boolean): void {
    this.dispatch?.({ type: 'SET_STREAMING', isStreaming });
  }

  /**
   * Set the current streaming message (partial message being built).
   */
  setStreamingMessage(message: ChatMessage | null): void {
    this.dispatch?.({ type: 'SET_STREAMING_MESSAGE', message });
    this.notifyListeners();
  }

  /**
   * Update the current streaming message with partial updates.
   * More efficient than replacing the entire message.
   */
  updateStreamingMessage(updates: Partial<ChatMessage>): void {
    this.dispatch?.({ type: 'UPDATE_STREAMING_MESSAGE', updates });
    // Don't notify listeners for every chunk - too frequent
  }

  // ========== Conversation State ==========

  /**
   * Set the current conversation ID.
   */
  setConversationId(id: string | null): void {
    this.dispatch?.({ type: 'SET_CONVERSATION_ID', id });
  }

  /**
   * Set usage information.
   */
  setUsage(usage: UsageInfo | null): void {
    this.dispatch?.({ type: 'SET_USAGE', usage });
  }

  // ========== Scroll Management ==========

  /**
   * Set auto-scroll enabled state.
   */
  setAutoScroll(enabled: boolean): void {
    this.dispatch?.({ type: 'SET_AUTO_SCROLL', enabled });
  }

  // ========== Batch Updates ==========

  /**
   * Perform multiple updates in a single render cycle.
   * React 18 automatically batches these, but this makes intent clear.
   */
  batchUpdate(updates: ChatAction[]): void {
    if (!this.dispatch) return;
    updates.forEach((action) => this.dispatch?.(action));
    this.notifyListeners();
  }
}
