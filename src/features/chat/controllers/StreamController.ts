/**
 * Stream controller for handling SDK stream chunks.
 *
 * Manages real-time message updates, tool call rendering, subagent
 * state tracking, and thinking indicator display.
 */

import {
  isPlanModeTool,
  isWriteEditTool,
  TOOL_AGENT_OUTPUT,
  TOOL_ASK_USER_QUESTION,
  TOOL_TASK,
  TOOL_TODO_WRITE,
} from '../../../core/tools/toolNames';
import type { ChatMessage, StreamChunk, SubagentInfo, ToolCallInfo } from '../../../core/types';
import type CortexPlugin from '../../../main';
import {
  type FileContextManager,
  isBlockedToolResult,
  parseAskUserQuestionInput,
  parseTodoInput,
} from '../../../ui';
import { FLAVOR_TEXTS } from '../constants';
import type { MessageRenderer } from '../rendering/MessageRenderer';
import type { AsyncSubagentManager } from '../services/AsyncSubagentManager';
import type { ChatState } from '../state/ChatState';
import { useChatStore } from '../store';

/** Dependencies for StreamController. */
export interface StreamControllerDeps {
  plugin: CortexPlugin;
  state: ChatState;
  renderer: MessageRenderer;
  asyncSubagentManager: AsyncSubagentManager;
  getMessagesEl: () => HTMLElement;
  getFileContextManager: () => FileContextManager | null;
  updateQueueIndicator: () => void;
  /** Callback to set plan mode active (for UI toggle sync). */
  setPlanModeActive: (active: boolean) => void;
}

/**
 * StreamController handles all stream chunk processing.
 */
export class StreamController {
  private deps: StreamControllerDeps;

  constructor(deps: StreamControllerDeps) {
    this.deps = deps;
  }

  // Note: syncStreamingToReact and updateStreamingMessageInReact removed
  // Zustand store handles React synchronization automatically via selectors

  // ============================================
  // Stream Chunk Handling
  // ============================================

  /** Processes a stream chunk and updates the message. */
  async handleStreamChunk(chunk: StreamChunk, msg: ChatMessage): Promise<void> {
    const { state, plugin } = this.deps;

    // Route subagent chunks
    if ('parentToolUseId' in chunk && chunk.parentToolUseId) {
      await this.handleSubagentChunk(chunk, msg);
      this.scrollToBottom();
      return;
    }

    switch (chunk.type) {
      case 'thinking': {
        // Finalize any pending text block before starting thinking
        const store = useChatStore.getState();
        if (store.streaming.textContent) {
          store.finalizeTextBlock();
        }
        // THE FIX: Use Zustand store - React auto-updates!
        store.appendStreamingThinking(chunk.content);

        // Also update legacy state for compatibility
        state.currentThinkingContent += chunk.content;
        if (!state.currentThinkingStartTime) {
          state.currentThinkingStartTime = Date.now();
        }
        this.hideThinkingIndicator();
        break;
      }

      case 'text': {
        // Finalize any pending thinking block before text
        const store = useChatStore.getState();
        if (store.streaming.thinkingContent) {
          store.finalizeThinkingBlock();
        }
        // THE FIX: Use Zustand store - React auto-updates!
        store.appendStreamingText(chunk.content);

        // Also update legacy state for compatibility
        msg.content += chunk.content;
        state.currentTextContent += chunk.content;
        break;
      }

      case 'tool_use': {
        // Finalize pending blocks before tool use
        const store = useChatStore.getState();
        if (store.streaming.thinkingContent) {
          store.finalizeThinkingBlock();
        }
        if (store.streaming.textContent) {
          store.finalizeTextBlock();
        }
        // Also update legacy state
        if (state.currentThinkingContent) {
          this.finalizeCurrentThinkingBlock(msg);
        }
        this.finalizeCurrentTextBlock(msg);

        if (chunk.name === TOOL_TASK) {
          // Track subagent spawn for usage filtering
          state.subagentsSpawnedThisStream++;
          const isAsync = this.deps.asyncSubagentManager.isAsyncTask(chunk.input);
          if (isAsync) {
            await this.handleAsyncTaskToolUse(chunk, msg);
          } else {
            await this.handleTaskToolUse(chunk, msg);
          }
          break;
        }

        if (chunk.name === TOOL_AGENT_OUTPUT) {
          this.handleAgentOutputToolUse(chunk, msg);
          break;
        }

        if (chunk.name === TOOL_ASK_USER_QUESTION) {
          this.handleAskUserQuestionToolUse(chunk, msg);
          break;
        }

        // Handle plan mode tools (EnterPlanMode, ExitPlanMode)
        if (isPlanModeTool(chunk.name)) {
          // Skip rendering - these tools are invisible to the user
          break;
        }

        this.handleRegularToolUse(chunk, msg);
        break;
      }

      case 'tool_result': {
        this.handleToolResult(chunk, msg);
        break;
      }

      case 'blocked':
        await this.appendText(`\n\n⚠️ **Blocked:** ${chunk.content}`);
        break;

      case 'error':
        await this.appendText(`\n\n❌ **Error:** ${chunk.content}`);
        break;

      case 'done':
        break;

      case 'usage': {
        // Skip usage updates from other sessions or when flagged (during session reset)
        const currentSessionId = plugin.agentService.getSessionId();
        const chunkSessionId = chunk.sessionId ?? null;
        if (
          (chunkSessionId && currentSessionId && chunkSessionId !== currentSessionId) ||
          (chunkSessionId && !currentSessionId)
        ) {
          break;
        }
        // Skip usage updates when subagents ran (SDK reports cumulative usage including subagents)
        if (state.subagentsSpawnedThisStream > 0) {
          break;
        }
        if (!state.ignoreUsageUpdates) {
          state.usage = chunk.usage;
        }
        break;
      }
    }

    this.scrollToBottom();
  }

  // ============================================
  // Tool Use Handling
  // ============================================

  /** Handles regular tool_use chunks. */
  private handleRegularToolUse(
    chunk: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> },
    msg: ChatMessage,
  ): void {
    const { plugin, state } = this.deps;
    const store = useChatStore.getState();

    // Skip rendering Write/Edit tools during plan mode (read-only mode)
    const isPlanMode = plugin.settings.permissionMode === 'plan';
    if (isPlanMode && isWriteEditTool(chunk.name)) {
      return;
    }

    const toolCall: ToolCallInfo = {
      id: chunk.id,
      name: chunk.name,
      input: chunk.input,
      status: 'running',
      isExpanded: false,
    };
    msg.toolCalls = msg.toolCalls || [];
    msg.toolCalls.push(toolCall);

    // Update Zustand store
    store.addToolCallToStreamingMessage(toolCall);

    // TodoWrite updates the persistent todo state
    if (chunk.name === TOOL_TODO_WRITE) {
      const todos = parseTodoInput(chunk.input);
      if (todos) {
        state.currentTodos = todos;
        store.setCurrentTodos(todos);
      } else {
        console.warn('[StreamController] TodoWrite input parsing failed', {
          toolId: chunk.id,
          inputKeys: Object.keys(chunk.input),
        });
        // Track as content block for rendering fallback
        msg.contentBlocks = msg.contentBlocks || [];
        msg.contentBlocks.push({ type: 'tool_use', toolId: chunk.id });
        store.addContentBlockToStreamingMessage({ type: 'tool_use', toolId: chunk.id });
      }
    } else {
      // Track as content block
      msg.contentBlocks = msg.contentBlocks || [];
      msg.contentBlocks.push({ type: 'tool_use', toolId: chunk.id });
      store.addContentBlockToStreamingMessage({ type: 'tool_use', toolId: chunk.id });
    }
  }

  /** Handles AskUserQuestion tool_use chunks. */
  private handleAskUserQuestionToolUse(
    chunk: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> },
    msg: ChatMessage,
  ): void {
    const store = useChatStore.getState();
    const toolCall: ToolCallInfo = {
      id: chunk.id,
      name: chunk.name,
      input: chunk.input,
      status: 'running',
      isExpanded: false,
    };
    msg.toolCalls = msg.toolCalls || [];
    msg.toolCalls.push(toolCall);

    // Update Zustand store
    store.addToolCallToStreamingMessage(toolCall);

    // Track as content block
    msg.contentBlocks = msg.contentBlocks || [];
    msg.contentBlocks.push({ type: 'tool_use', toolId: chunk.id });
    store.addContentBlockToStreamingMessage({ type: 'tool_use', toolId: chunk.id });
  }

  /** Handles tool_result chunks. */
  private handleToolResult(
    chunk: { type: 'tool_result'; id: string; content: string; isError?: boolean },
    msg: ChatMessage,
  ): void {
    const { plugin, state } = this.deps;
    const store = useChatStore.getState();

    // Check if it's a sync subagent result
    const subagentInfo = state.activeSubagentInfos.get(chunk.id);
    if (subagentInfo) {
      this.finalizeSubagent(chunk, msg, subagentInfo);
      return;
    }

    // Check if it's an async task result
    if (this.handleAsyncTaskToolResult(chunk, msg)) {
      return;
    }

    // Check if it's an agent output result
    if (this.handleAgentOutputToolResult(chunk, msg)) {
      return;
    }

    const existingToolCall = msg.toolCalls?.find((tc) => tc.id === chunk.id);

    // Check if it's an AskUserQuestion result
    if (existingToolCall?.name === TOOL_ASK_USER_QUESTION) {
      const isBlocked = isBlockedToolResult(chunk.content, chunk.isError);
      existingToolCall.status = isBlocked ? 'blocked' : chunk.isError ? 'error' : 'completed';
      existingToolCall.result = chunk.content;

      // Get answers from stored map (set by CortexService callback)
      const storedAnswers = plugin.agentService.getAskUserQuestionAnswers(chunk.id);
      const parsed = parseAskUserQuestionInput(existingToolCall.input);

      // Use stored answers, or fall back to parsed from input
      const answers = storedAnswers || parsed?.answers;

      // Store answers back into input for session persistence
      if (answers) {
        existingToolCall.input = { ...existingToolCall.input, answers };
      }

      // Update Zustand store
      store.updateToolCallInStreamingMessage(chunk.id, {
        status: existingToolCall.status,
        result: chunk.content,
        input: existingToolCall.input,
      });
      return;
    }

    // Regular tool result
    const isBlocked = isBlockedToolResult(chunk.content, chunk.isError);

    if (existingToolCall) {
      existingToolCall.status = isBlocked ? 'blocked' : chunk.isError ? 'error' : 'completed';
      existingToolCall.result = chunk.content;

      // Get diff data for Write/Edit tools
      if (isWriteEditTool(existingToolCall.name) && !chunk.isError && !isBlocked) {
        const diffData = plugin.agentService.getDiffData(chunk.id);
        if (diffData) {
          existingToolCall.diffData = diffData;
        }
      }

      // Update Zustand store
      store.updateToolCallInStreamingMessage(chunk.id, {
        status: existingToolCall.status,
        result: chunk.content,
        diffData: existingToolCall.diffData,
      });
    }
  }

  // ============================================
  // Text Block Management
  // ============================================

  /** Appends text to the current text block. */
  async appendText(text: string): Promise<void> {
    const { state } = this.deps;

    // Track text content for message data (React renders via bridge)
    state.currentTextContent += text;
  }

  /** Finalizes the current text block. */
  finalizeCurrentTextBlock(msg?: ChatMessage): void {
    const { state } = this.deps;
    if (msg && state.currentTextContent) {
      msg.contentBlocks = msg.contentBlocks || [];
      msg.contentBlocks.push({ type: 'text', content: state.currentTextContent });
    }
    // Reset text state (React handles rendering)
    state.currentTextContent = '';
  }

  // ============================================
  // Thinking Block Management
  // ============================================

  /** Appends thinking content. */
  async appendThinking(content: string, _msg: ChatMessage): Promise<void> {
    const { state } = this.deps;

    this.hideThinkingIndicator();

    // Track thinking content for message data (React renders via bridge)
    if (!state.currentThinkingContent) {
      state.currentThinkingContent = '';
      state.currentThinkingStartTime = Date.now();
    }
    state.currentThinkingContent += content;
  }

  /** Finalizes the current thinking block. */
  finalizeCurrentThinkingBlock(msg?: ChatMessage): void {
    const { state } = this.deps;
    if (!state.currentThinkingContent) return;

    // Calculate duration
    const durationSeconds = state.currentThinkingStartTime
      ? (Date.now() - state.currentThinkingStartTime) / 1000
      : 0;

    if (msg && state.currentThinkingContent) {
      msg.contentBlocks = msg.contentBlocks || [];
      msg.contentBlocks.push({
        type: 'thinking',
        content: state.currentThinkingContent,
        durationSeconds,
      });
    }

    // Reset thinking state (React handles rendering)
    state.currentThinkingContent = '';
    state.currentThinkingStartTime = null;
  }

  // ============================================
  // Sync Subagent Handling
  // ============================================

  /** Handles Task tool_use by creating a sync subagent block. */
  private async handleTaskToolUse(
    chunk: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> },
    msg: ChatMessage,
  ): Promise<void> {
    const { state } = this.deps;
    const store = useChatStore.getState();

    // Create subagent info for message data
    const subagentInfo: SubagentInfo = {
      id: chunk.id,
      description: String(chunk.input.description || 'Running task...'),
      status: 'running',
      isExpanded: false,
      toolCalls: [],
    };

    // Track in active subagents map for routing nested chunks
    state.activeSubagentInfos.set(chunk.id, subagentInfo);
    store.setActiveSubagent(chunk.id, subagentInfo);

    msg.subagents = msg.subagents || [];
    msg.subagents.push(subagentInfo);

    msg.contentBlocks = msg.contentBlocks || [];
    msg.contentBlocks.push({ type: 'subagent', subagentId: chunk.id });

    // Update Zustand store
    store.addSubagentToStreamingMessage(subagentInfo);
    store.addContentBlockToStreamingMessage({ type: 'subagent', subagentId: chunk.id });
  }

  /** Routes chunks from subagents. */
  private async handleSubagentChunk(chunk: StreamChunk, _msg: ChatMessage): Promise<void> {
    if (!('parentToolUseId' in chunk) || !chunk.parentToolUseId) {
      return;
    }
    const parentToolUseId = chunk.parentToolUseId;
    const { state } = this.deps;
    const subagentInfo = state.activeSubagentInfos.get(parentToolUseId);

    if (!subagentInfo) {
      return;
    }

    switch (chunk.type) {
      case 'tool_use': {
        const toolCall: ToolCallInfo = {
          id: chunk.id,
          name: chunk.name,
          input: chunk.input,
          status: 'running',
          isExpanded: false,
        };
        // Add tool call to subagent info (React renders via bridge)
        subagentInfo.toolCalls.push(toolCall);
        break;
      }

      case 'tool_result': {
        const toolCall = subagentInfo.toolCalls.find((tc) => tc.id === chunk.id);
        if (toolCall) {
          const isBlocked = isBlockedToolResult(chunk.content, chunk.isError);
          toolCall.status = isBlocked ? 'blocked' : chunk.isError ? 'error' : 'completed';
          toolCall.result = chunk.content;
          // Get diff data for Write/Edit tools
          this.deps.plugin.agentService.getDiffData(chunk.id);
        }
        break;
      }

      case 'text':
      case 'thinking':
        break;
    }
  }

  /** Finalizes a sync subagent when its Task tool_result is received. */
  private finalizeSubagent(
    chunk: { type: 'tool_result'; id: string; content: string; isError?: boolean },
    msg: ChatMessage,
    subagentInfo: SubagentInfo,
  ): void {
    const { state } = this.deps;
    const store = useChatStore.getState();
    const isError = chunk.isError || false;

    // Update subagent info
    subagentInfo.status = isError ? 'error' : 'completed';
    subagentInfo.result = chunk.content;

    // Also update in message's subagents array
    const msgSubagentInfo = msg.subagents?.find((s) => s.id === chunk.id);
    if (msgSubagentInfo) {
      msgSubagentInfo.status = subagentInfo.status;
      msgSubagentInfo.result = chunk.content;
    }

    state.activeSubagentInfos.delete(chunk.id);
    store.deleteActiveSubagent(chunk.id);

    // Update Zustand store
    store.updateSubagentInStreamingMessage(chunk.id, {
      status: subagentInfo.status,
      result: chunk.content,
    });
  }

  // ============================================
  // Async Subagent Handling
  // ============================================

  /** Handles async Task tool_use (run_in_background=true). */
  private async handleAsyncTaskToolUse(
    chunk: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> },
    msg: ChatMessage,
  ): Promise<void> {
    const { asyncSubagentManager } = this.deps;
    const store = useChatStore.getState();

    // Create async subagent info
    const subagentInfo = asyncSubagentManager.createAsyncSubagent(chunk.id, chunk.input);

    msg.subagents = msg.subagents || [];
    msg.subagents.push(subagentInfo);

    msg.contentBlocks = msg.contentBlocks || [];
    msg.contentBlocks.push({ type: 'subagent', subagentId: chunk.id, mode: 'async' });

    // Update Zustand store
    store.addSubagentToStreamingMessage(subagentInfo);
    store.addContentBlockToStreamingMessage({
      type: 'subagent',
      subagentId: chunk.id,
      mode: 'async',
    });
  }

  /** Handles AgentOutputTool tool_use (invisible, links to async subagent). */
  private handleAgentOutputToolUse(
    chunk: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> },
    _msg: ChatMessage,
  ): void {
    const toolCall: ToolCallInfo = {
      id: chunk.id,
      name: chunk.name,
      input: chunk.input,
      status: 'running',
      isExpanded: false,
    };

    this.deps.asyncSubagentManager.handleAgentOutputToolUse(toolCall);
  }

  /** Handles async Task tool_result to extract agent_id. */
  private handleAsyncTaskToolResult(
    chunk: { type: 'tool_result'; id: string; content: string; isError?: boolean },
    _msg: ChatMessage,
  ): boolean {
    const { asyncSubagentManager } = this.deps;
    if (!asyncSubagentManager.isPendingAsyncTask(chunk.id)) {
      return false;
    }

    asyncSubagentManager.handleTaskToolResult(chunk.id, chunk.content, chunk.isError);
    return true;
  }

  /** Handles AgentOutputTool result to finalize async subagent. */
  private handleAgentOutputToolResult(
    chunk: { type: 'tool_result'; id: string; content: string; isError?: boolean },
    _msg: ChatMessage,
  ): boolean {
    const { asyncSubagentManager } = this.deps;
    const isLinked = asyncSubagentManager.isLinkedAgentOutputTool(chunk.id);

    const handled = asyncSubagentManager.handleAgentOutputToolResult(
      chunk.id,
      chunk.content,
      chunk.isError || false,
    );

    return isLinked || handled !== undefined;
  }

  /** Callback from AsyncSubagentManager when state changes. */
  onAsyncSubagentStateChange(subagent: SubagentInfo): void {
    // Update subagent in messages array (React renders via bridge)
    this.updateSubagentInMessages(subagent);
    this.scrollToBottom();
  }

  /** Updates subagent info in messages array. */
  private updateSubagentInMessages(subagent: SubagentInfo): void {
    const { state } = this.deps;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const msg = state.messages[i];
      if (msg.role === 'assistant' && msg.subagents) {
        const idx = msg.subagents.findIndex((s) => s.id === subagent.id);
        if (idx !== -1) {
          msg.subagents[idx] = subagent;
          return;
        }
      }
    }
  }

  // ============================================
  // Thinking Indicator
  // ============================================

  /** Shows the thinking indicator. */
  showThinkingIndicator(parentEl: HTMLElement): void {
    const { state } = this.deps;

    if (state.thinkingEl) {
      // Re-append to ensure it's at the bottom
      parentEl.appendChild(state.thinkingEl);
      this.deps.updateQueueIndicator();
      return;
    }

    state.thinkingEl = parentEl.createDiv({ cls: 'cortex-thinking' });
    const randomText = FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)];
    state.thinkingEl.createSpan({ text: randomText });
    state.thinkingEl.createSpan({ text: ' (esc to interrupt)', cls: 'cortex-thinking-hint' });

    // Queue indicator line (initially hidden)
    state.queueIndicatorEl = state.thinkingEl.createDiv({ cls: 'cortex-queue-indicator' });
    this.deps.updateQueueIndicator();
  }

  /** Hides the thinking indicator. */
  hideThinkingIndicator(): void {
    const { state } = this.deps;
    if (state.thinkingEl) {
      state.thinkingEl.remove();
      state.thinkingEl = null;
    }
    state.queueIndicatorEl = null;
  }

  // ============================================
  // Utilities
  // ============================================

  /** Scrolls messages to bottom. */
  private scrollToBottom(): void {
    const messagesEl = this.deps.getMessagesEl();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /** Resets streaming state after completion. */
  resetStreamingState(): void {
    const { state } = this.deps;
    this.hideThinkingIndicator();
    // Reset text/thinking tracking
    state.currentTextContent = '';
    state.currentThinkingContent = '';
    state.currentThinkingStartTime = null;
    // Clear active subagent tracking
    state.activeSubagentInfos.clear();

    // Also reset Zustand store streaming state
    useChatStore.getState().resetStreamingState();
  }
}
