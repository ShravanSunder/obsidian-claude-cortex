/**
 * Zustand store for chat state management.
 *
 * Single source of truth that replaces the manual ChatState → ChatBridge → ChatContext
 * synchronization pattern. Controllers call store actions, React components subscribe
 * via selectors, and updates happen automatically.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type {
  ChatMessage,
  ContentBlock,
  SubagentInfo,
  ToolCallInfo,
  UsageInfo,
} from '../../../core/types';
import type { PlanModeState, QueuedMessage, TodoItem } from '../state/types';

// ============================================
// State Types
// ============================================

/** Streaming-specific state that updates on every chunk */
export interface StreamingState {
  /** Accumulated text content during streaming */
  textContent: string;
  /** Accumulated thinking content during streaming */
  thinkingContent: string;
  /** Start time for thinking block duration calculation */
  thinkingStartTime: number | null;
}

/** Full chat store state */
export interface ChatStoreState {
  // Core
  messages: ChatMessage[];
  isStreaming: boolean;
  conversationId: string | null;

  // Streaming (the key fix - React subscribes to this!)
  streaming: StreamingState;
  streamingMessage: ChatMessage | null;

  // Active subagent tracking during streaming
  activeSubagentInfos: Map<string, SubagentInfo>;

  // Session
  usage: UsageInfo | null;
  currentTodos: TodoItem[] | null;
  planModeState: PlanModeState | null;

  // Queue
  queuedMessage: QueuedMessage | null;
  cancelRequested: boolean;

  // Plan mode flags
  planModeRequested: boolean;
  planModeActivationPending: boolean;
  pendingPlanContent: string | null;
}

// ============================================
// Action Types
// ============================================

export interface ChatStoreActions {
  // Streaming lifecycle - THIS IS THE FIX
  startStreaming: (msg: ChatMessage) => void;
  appendStreamingText: (chunk: string) => void;
  appendStreamingThinking: (chunk: string) => void;
  finalizeTextBlock: () => void;
  finalizeThinkingBlock: () => void;
  endStreaming: () => void;

  // Streaming message mutations
  addToolCallToStreamingMessage: (toolCall: ToolCallInfo) => void;
  updateToolCallInStreamingMessage: (toolId: string, updates: Partial<ToolCallInfo>) => void;
  addContentBlockToStreamingMessage: (block: ContentBlock) => void;
  addSubagentToStreamingMessage: (subagent: SubagentInfo) => void;
  updateSubagentInStreamingMessage: (subagentId: string, updates: Partial<SubagentInfo>) => void;

  // Active subagent tracking
  setActiveSubagent: (id: string, info: SubagentInfo) => void;
  getActiveSubagent: (id: string) => SubagentInfo | undefined;
  deleteActiveSubagent: (id: string) => void;
  clearActiveSubagents: () => void;

  // Messages
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // Conversation
  setConversationId: (id: string | null) => void;

  // Usage
  setUsage: (usage: UsageInfo | null) => void;

  // Todos
  setCurrentTodos: (todos: TodoItem[] | null) => void;

  // Queue
  setQueuedMessage: (msg: QueuedMessage | null) => void;
  setCancelRequested: (requested: boolean) => void;

  // Plan mode
  setPlanModeState: (state: PlanModeState | null) => void;
  setPlanModeRequested: (requested: boolean) => void;
  setPlanModeActivationPending: (pending: boolean) => void;
  setPendingPlanContent: (content: string | null) => void;
  resetPlanModeState: () => void;

  // Reset
  resetForNewConversation: () => void;
  resetStreamingState: () => void;
}

// ============================================
// Initial State
// ============================================

const initialStreamingState: StreamingState = {
  textContent: '',
  thinkingContent: '',
  thinkingStartTime: null,
};

const initialState: ChatStoreState = {
  messages: [],
  isStreaming: false,
  conversationId: null,
  streaming: { ...initialStreamingState },
  streamingMessage: null,
  activeSubagentInfos: new Map(),
  usage: null,
  currentTodos: null,
  planModeState: null,
  queuedMessage: null,
  cancelRequested: false,
  planModeRequested: false,
  planModeActivationPending: false,
  pendingPlanContent: null,
};

// ============================================
// Store
// ============================================

export const useChatStore = create<ChatStoreState & ChatStoreActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ========================================
    // Streaming Lifecycle - THE KEY FIX
    // ========================================

    startStreaming: (msg) =>
      set({
        isStreaming: true,
        streamingMessage: msg,
        streaming: { ...initialStreamingState },
        cancelRequested: false,
      }),

    appendStreamingText: (chunk) =>
      set((state) => {
        const newTextContent = state.streaming.textContent + chunk;
        const newContent = state.streamingMessage ? state.streamingMessage.content + chunk : chunk;

        return {
          streaming: {
            ...state.streaming,
            textContent: newTextContent,
          },
          streamingMessage: state.streamingMessage
            ? { ...state.streamingMessage, content: newContent }
            : null,
        };
      }),

    appendStreamingThinking: (chunk) =>
      set((state) => {
        const isFirstChunk = !state.streaming.thinkingContent;
        return {
          streaming: {
            ...state.streaming,
            thinkingContent: state.streaming.thinkingContent + chunk,
            thinkingStartTime: isFirstChunk ? Date.now() : state.streaming.thinkingStartTime,
          },
        };
      }),

    finalizeTextBlock: () =>
      set((state) => {
        if (!state.streaming.textContent || !state.streamingMessage) {
          return state;
        }

        const textBlock: ContentBlock = {
          type: 'text',
          content: state.streaming.textContent,
        };

        const updatedBlocks = [...(state.streamingMessage.contentBlocks || []), textBlock];

        return {
          streaming: {
            ...state.streaming,
            textContent: '',
          },
          streamingMessage: {
            ...state.streamingMessage,
            contentBlocks: updatedBlocks,
          },
        };
      }),

    finalizeThinkingBlock: () =>
      set((state) => {
        if (!state.streaming.thinkingContent || !state.streamingMessage) {
          return state;
        }

        const durationSeconds = state.streaming.thinkingStartTime
          ? (Date.now() - state.streaming.thinkingStartTime) / 1000
          : 0;

        const thinkingBlock: ContentBlock = {
          type: 'thinking',
          content: state.streaming.thinkingContent,
          durationSeconds,
        };

        const updatedBlocks = [...(state.streamingMessage.contentBlocks || []), thinkingBlock];

        return {
          streaming: {
            ...state.streaming,
            thinkingContent: '',
            thinkingStartTime: null,
          },
          streamingMessage: {
            ...state.streamingMessage,
            contentBlocks: updatedBlocks,
          },
        };
      }),

    endStreaming: () =>
      set((state) => {
        if (!state.streamingMessage) {
          return {
            isStreaming: false,
            streaming: { ...initialStreamingState },
            streamingMessage: null,
          };
        }

        // Finalize any pending text/thinking blocks before ending
        let finalMessage = { ...state.streamingMessage };
        const finalBlocks = [...(finalMessage.contentBlocks || [])];

        if (state.streaming.textContent) {
          finalBlocks.push({ type: 'text', content: state.streaming.textContent });
        }

        if (state.streaming.thinkingContent) {
          const durationSeconds = state.streaming.thinkingStartTime
            ? (Date.now() - state.streaming.thinkingStartTime) / 1000
            : 0;
          finalBlocks.push({
            type: 'thinking',
            content: state.streaming.thinkingContent,
            durationSeconds,
          });
        }

        finalMessage = {
          ...finalMessage,
          contentBlocks: finalBlocks.length > 0 ? finalBlocks : undefined,
        };

        return {
          isStreaming: false,
          streaming: { ...initialStreamingState },
          streamingMessage: null,
          messages: [...state.messages, finalMessage],
        };
      }),

    // ========================================
    // Streaming Message Mutations
    // ========================================

    addToolCallToStreamingMessage: (toolCall) =>
      set((state) => {
        if (!state.streamingMessage) return state;
        const toolCalls = [...(state.streamingMessage.toolCalls || []), toolCall];
        return {
          streamingMessage: { ...state.streamingMessage, toolCalls },
        };
      }),

    updateToolCallInStreamingMessage: (toolId, updates) =>
      set((state) => {
        if (!state.streamingMessage?.toolCalls) return state;
        const toolCalls = state.streamingMessage.toolCalls.map((tc) =>
          tc.id === toolId ? { ...tc, ...updates } : tc,
        );
        return {
          streamingMessage: { ...state.streamingMessage, toolCalls },
        };
      }),

    addContentBlockToStreamingMessage: (block) =>
      set((state) => {
        if (!state.streamingMessage) return state;
        const contentBlocks = [...(state.streamingMessage.contentBlocks || []), block];
        return {
          streamingMessage: { ...state.streamingMessage, contentBlocks },
        };
      }),

    addSubagentToStreamingMessage: (subagent) =>
      set((state) => {
        if (!state.streamingMessage) return state;
        const subagents = [...(state.streamingMessage.subagents || []), subagent];
        return {
          streamingMessage: { ...state.streamingMessage, subagents },
        };
      }),

    updateSubagentInStreamingMessage: (subagentId, updates) =>
      set((state) => {
        if (!state.streamingMessage?.subagents) return state;
        const subagents = state.streamingMessage.subagents.map((s) =>
          s.id === subagentId ? { ...s, ...updates } : s,
        );
        return {
          streamingMessage: { ...state.streamingMessage, subagents },
        };
      }),

    // ========================================
    // Active Subagent Tracking
    // ========================================

    setActiveSubagent: (id, info) =>
      set((state) => {
        const newMap = new Map(state.activeSubagentInfos);
        newMap.set(id, info);
        return { activeSubagentInfos: newMap };
      }),

    getActiveSubagent: (id) => get().activeSubagentInfos.get(id),

    deleteActiveSubagent: (id) =>
      set((state) => {
        const newMap = new Map(state.activeSubagentInfos);
        newMap.delete(id);
        return { activeSubagentInfos: newMap };
      }),

    clearActiveSubagents: () => set({ activeSubagentInfos: new Map() }),

    // ========================================
    // Messages
    // ========================================

    setMessages: (messages) => set({ messages }),

    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),

    updateMessage: (id, updates) =>
      set((state) => ({
        messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
      })),

    clearMessages: () => set({ messages: [] }),

    // ========================================
    // Conversation
    // ========================================

    setConversationId: (id) => set({ conversationId: id }),

    // ========================================
    // Usage
    // ========================================

    setUsage: (usage) => set({ usage }),

    // ========================================
    // Todos
    // ========================================

    setCurrentTodos: (todos) => {
      // Normalize empty arrays to null for consistency
      const normalizedValue = todos && todos.length > 0 ? todos : null;
      set({ currentTodos: normalizedValue });
    },

    // ========================================
    // Queue
    // ========================================

    setQueuedMessage: (msg) => set({ queuedMessage: msg }),

    setCancelRequested: (requested) => set({ cancelRequested: requested }),

    // ========================================
    // Plan Mode
    // ========================================

    setPlanModeState: (planModeState) => set({ planModeState }),

    setPlanModeRequested: (requested) => set({ planModeRequested: requested }),

    setPlanModeActivationPending: (pending) => set({ planModeActivationPending: pending }),

    setPendingPlanContent: (content) => set({ pendingPlanContent: content }),

    resetPlanModeState: () => set({ planModeState: null }),

    // ========================================
    // Reset
    // ========================================

    resetForNewConversation: () =>
      set({
        messages: [],
        isStreaming: false,
        streaming: { ...initialStreamingState },
        streamingMessage: null,
        activeSubagentInfos: new Map(),
        usage: null,
        currentTodos: null,
        queuedMessage: null,
        cancelRequested: false,
        planModeRequested: false,
        planModeActivationPending: false,
      }),

    resetStreamingState: () =>
      set({
        isStreaming: false,
        streaming: { ...initialStreamingState },
        streamingMessage: null,
        cancelRequested: false,
        activeSubagentInfos: new Map(),
      }),
  })),
);

// ============================================
// Selectors
// ============================================

/** Select visible messages (non-hidden) */
export const selectVisibleMessages = (state: ChatStoreState) =>
  state.messages.filter((msg) => !msg.hidden);

/** Select streaming text content */
export const selectStreamingText = (state: ChatStoreState) => state.streaming.textContent;

/** Select streaming thinking content */
export const selectStreamingThinking = (state: ChatStoreState) => state.streaming.thinkingContent;

/** Select whether streaming is active */
export const selectIsStreaming = (state: ChatStoreState) => state.isStreaming;

/** Select the current streaming message */
export const selectStreamingMessage = (state: ChatStoreState) => state.streamingMessage;

/** Select usage info */
export const selectUsage = (state: ChatStoreState) => state.usage;

/** Select current todos */
export const selectCurrentTodos = (state: ChatStoreState) => state.currentTodos;

/** Select conversation ID */
export const selectConversationId = (state: ChatStoreState) => state.conversationId;

/** Select plan mode state */
export const selectPlanModeState = (state: ChatStoreState) => state.planModeState;

/** Select queued message */
export const selectQueuedMessage = (state: ChatStoreState) => state.queuedMessage;

/** Select cancel requested flag */
export const selectCancelRequested = (state: ChatStoreState) => state.cancelRequested;

// ============================================
// Vanilla JS Access
// ============================================

/** Direct access for vanilla JS code (controllers) */
export const chatStore = useChatStore;
