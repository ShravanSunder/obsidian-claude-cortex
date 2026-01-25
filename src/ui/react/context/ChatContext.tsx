/**
 * React context for chat state management
 *
 * Provides centralized state for the chat interface, bridging the
 * imperative ChatState with React's declarative rendering model.
 */

import { createContext, type Dispatch, type ReactNode, useContext, useReducer } from 'react';
import type { ChatMessage, UsageInfo } from '../../../core/types';

/** Chat state managed by React */
export interface ChatContextState {
  /** All messages in the current conversation */
  messages: ChatMessage[];
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Current streaming message being built (partial) */
  currentStreamingMessage: ChatMessage | null;
  /** Whether auto-scroll is enabled */
  autoScrollEnabled: boolean;
  /** Context window usage information */
  usage: UsageInfo | null;
  /** Current conversation ID */
  conversationId: string | null;
}

/** Actions that can be dispatched to update chat state */
export type ChatAction =
  | { type: 'SET_MESSAGES'; messages: ChatMessage[] }
  | { type: 'SET_STREAMING_MESSAGE'; message: ChatMessage | null }
  | { type: 'UPDATE_STREAMING_MESSAGE'; updates: Partial<ChatMessage> }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'SET_AUTO_SCROLL'; enabled: boolean }
  | { type: 'SET_USAGE'; usage: UsageInfo | null }
  | { type: 'SET_CONVERSATION_ID'; id: string | null }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'CLEAR_MESSAGES' };

const initialState: ChatContextState = {
  messages: [],
  isStreaming: false,
  currentStreamingMessage: null,
  autoScrollEnabled: true,
  usage: null,
  conversationId: null,
};

function chatReducer(state: ChatContextState, action: ChatAction): ChatContextState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages };

    case 'SET_STREAMING_MESSAGE':
      return { ...state, currentStreamingMessage: action.message };

    case 'UPDATE_STREAMING_MESSAGE':
      if (!state.currentStreamingMessage) return state;
      return {
        ...state,
        currentStreamingMessage: {
          ...state.currentStreamingMessage,
          ...action.updates,
        },
      };

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.isStreaming };

    case 'SET_AUTO_SCROLL':
      return { ...state, autoScrollEnabled: action.enabled };

    case 'SET_USAGE':
      return { ...state, usage: action.usage };

    case 'SET_CONVERSATION_ID':
      return { ...state, conversationId: action.id };

    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [], currentStreamingMessage: null };

    default:
      return state;
  }
}

/** Context value including state and dispatch */
interface ChatContextValue {
  state: ChatContextState;
  dispatch: Dispatch<ChatAction>;
}

/** Chat context - null when outside provider */
export const ChatContext = createContext<ChatContextValue | null>(null);

/** Hook to access chat context */
export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}

/** Props for ChatProvider */
export interface ChatProviderProps {
  children: ReactNode;
  /** Initial messages to populate */
  initialMessages?: ChatMessage[];
  /** Initial conversation ID */
  initialConversationId?: string | null;
}

/**
 * Provider component that manages chat state.
 * Wrap your chat components with this to enable state access.
 */
export function ChatProvider({
  children,
  initialMessages = [],
  initialConversationId = null,
}: ChatProviderProps) {
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialState,
    messages: initialMessages,
    conversationId: initialConversationId,
  });

  return <ChatContext.Provider value={{ state, dispatch }}>{children}</ChatContext.Provider>;
}
