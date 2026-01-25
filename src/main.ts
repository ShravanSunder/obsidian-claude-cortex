/**
 * Cortex - Obsidian plugin entry point
 *
 * Registers the sidebar chat view, settings tab, and commands.
 * Manages conversation persistence and environment variable configuration.
 */

import type { Editor, MarkdownView } from 'obsidian';
import { Notice, Plugin } from 'obsidian';

import { CortexService } from './core/agent/CortexService';
import { deleteCachedImages } from './core/images/imageCache';
import { StorageService } from './core/storage';
import type { Conversation, ConversationMeta, CortexSettings } from './core/types';
import { DEFAULT_CLAUDE_MODELS, DEFAULT_SETTINGS, VIEW_TYPE_CORTEX } from './core/types';
import { CortexView } from './features/chat/CortexView';
import { McpService } from './features/mcp/McpService';
import { CortexSettingTab } from './features/settings/CortexSettings';
import { type InlineEditContext, InlineEditModal } from './ui/modals/InlineEditModal';
import { ClaudeCliResolver } from './utils/claudeCli';
import { buildCursorContext } from './utils/editor';
import {
  getCurrentModelFromEnvironment,
  getModelsFromEnvironment,
  parseEnvironmentVariables,
} from './utils/env';

/**
 * Main plugin class for Cortex.
 * Handles plugin lifecycle, settings persistence, and conversation management.
 */
export default class CortexPlugin extends Plugin {
  settings: CortexSettings;
  agentService: CortexService;
  mcpService: McpService;
  storage: StorageService;
  cliResolver: ClaudeCliResolver;
  /** Lazily loaded conversations - only populated on demand */
  private conversations: Conversation[] = [];
  /** Conversation metadata for quick listing (loaded at startup) */
  private conversationMetas: ConversationMeta[] = [];
  private activeConversationId: string | null = null;
  private runtimeEnvironmentVariables = '';
  private hasNotifiedEnvChange = false;

  async onload() {
    await this.loadSettings();

    this.cliResolver = new ClaudeCliResolver();

    // Initialize MCP service first (creates McpServerManager internally)
    this.mcpService = new McpService(this);
    await this.mcpService.loadServers();

    // Initialize agent service with the MCP manager
    this.agentService = new CortexService(this, this.mcpService.getManager());

    // Pre-warm the Claude Agent SDK in the background
    // This spawns the subprocess early so the first user message is faster
    // Use the active conversation's session ID if available
    const activeConv = this.getActiveConversation();
    const sessionToPreWarm = activeConv?.sessionId ?? undefined;
    void this.agentService.preWarm(sessionToPreWarm);

    this.registerView(VIEW_TYPE_CORTEX, (leaf) => new CortexView(leaf, this));

    this.addRibbonIcon('bot', 'Open Cortex', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-view',
      name: 'Open chat view',
      callback: () => {
        this.activateView();
      },
    });

    this.addCommand({
      id: 'inline-edit',
      name: 'Inline edit',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const selectedText = editor.getSelection();
        const notePath = view.file?.path || 'unknown';

        let editContext: InlineEditContext;
        if (selectedText.trim()) {
          // Selection mode
          editContext = { mode: 'selection', selectedText };
        } else {
          // Cursor mode - build cursor context
          const cursor = editor.getCursor();
          const cursorContext = buildCursorContext(
            (line) => editor.getLine(line),
            editor.lineCount(),
            cursor.line,
            cursor.ch,
          );
          editContext = { mode: 'cursor', cursorContext };
        }

        const modal = new InlineEditModal(this.app, this, editContext, notePath);
        const result = await modal.openAndWait();

        if (result.decision === 'accept' && result.editedText !== undefined) {
          new Notice(editContext.mode === 'cursor' ? 'Inserted' : 'Edit applied');
        }
      },
    });

    this.addSettingTab(new CortexSettingTab(this.app, this));
  }

  onunload() {
    this.agentService.cleanup();
  }

  /** Opens the Cortex sidebar view, creating it if necessary. */
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CORTEX)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_CORTEX,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /** Loads settings and conversations from persistent storage. */
  async loadSettings() {
    // Initialize storage service (handles migration if needed)
    this.storage = new StorageService(this);
    const { settings, state } = await this.storage.initialize();

    // Load slash commands from files
    const slashCommands = await this.storage.commands.loadAll();

    // Merge settings with defaults, state fields, and slashCommands
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      // State fields from data.json
      lastEnvHash: state.lastEnvHash,
      lastClaudeModel: state.lastClaudeModel,
      lastCustomModel: state.lastCustomModel,
      slashCommands,
    };

    // Load only conversation metadata at startup (lazy loading)
    // Full conversations are loaded on-demand via ensureConversationLoaded()
    this.conversationMetas = await this.storage.sessions.listConversations();
    this.conversations = []; // Empty - loaded on demand
    this.activeConversationId = state.activeConversationId;

    // Validate active conversation exists in metadata
    if (
      this.activeConversationId &&
      !this.conversationMetas.find((c) => c.id === this.activeConversationId)
    ) {
      this.activeConversationId = null;
    }

    // Pre-load the active conversation so getActiveConversation() works synchronously
    const backfilledConversations: Conversation[] = [];
    if (this.activeConversationId) {
      const activeConv = await this.ensureConversationLoaded(this.activeConversationId);
      if (activeConv && activeConv.lastResponseAt == null && activeConv.messages.length > 0) {
        // backfillConversationResponseTimestamps logic already in ensureConversationLoaded
      }
    }

    this.runtimeEnvironmentVariables = this.settings.environmentVariables || '';
    const { changed, invalidatedConversations } = this.reconcileModelWithEnvironment(
      this.runtimeEnvironmentVariables,
    );

    if (changed) {
      await this.saveSettings();
    }

    // Persist backfilled and invalidated conversations to their session files
    const conversationsToSave = new Set([...backfilledConversations, ...invalidatedConversations]);
    for (const conv of conversationsToSave) {
      await this.storage.sessions.saveConversation(conv);
    }
  }

  private backfillConversationResponseTimestamps(): Conversation[] {
    const updated: Conversation[] = [];
    for (const conv of this.conversations) {
      if (conv.lastResponseAt != null) continue;
      if (!conv.messages || conv.messages.length === 0) continue;

      for (let i = conv.messages.length - 1; i >= 0; i--) {
        const msg = conv.messages[i];
        if (msg.role === 'assistant') {
          conv.lastResponseAt = msg.timestamp;
          updated.push(conv);
          break;
        }
      }
    }
    return updated;
  }

  /** Persists settings to storage. */
  async saveSettings() {
    // Save settings (excluding state fields and slashCommands)
    const {
      slashCommands: _,
      lastEnvHash: __,
      lastClaudeModel: ___,
      lastCustomModel: ____,
      ...settingsToSave
    } = this.settings;
    await this.storage.settings.save(settingsToSave);

    // Save state fields to data.json
    await this.storage.saveState({
      activeConversationId: this.activeConversationId,
      lastEnvHash: this.settings.lastEnvHash || '',
      lastClaudeModel: this.settings.lastClaudeModel || 'haiku',
      lastCustomModel: this.settings.lastCustomModel || '',
    });
  }

  /** Updates and persists environment variables, notifying if restart is needed. */
  async applyEnvironmentVariables(envText: string): Promise<void> {
    this.settings.environmentVariables = envText;
    await this.saveSettings();

    if (envText !== this.runtimeEnvironmentVariables) {
      if (!this.hasNotifiedEnvChange) {
        new Notice('Environment variables changed. Restart the plugin for changes to take effect.');
        this.hasNotifiedEnvChange = true;
      }
    } else {
      this.hasNotifiedEnvChange = false;
    }
  }

  /** Returns the runtime environment variables (fixed at plugin load). */
  getActiveEnvironmentVariables(): string {
    return this.runtimeEnvironmentVariables;
  }

  getResolvedClaudeCliPath(): string | null {
    return this.cliResolver.resolve(
      this.settings.claudeCliPath,
      this.getActiveEnvironmentVariables(),
    );
  }

  private getDefaultModelValues(): string[] {
    return DEFAULT_CLAUDE_MODELS.map((m) => m.value);
  }

  private getPreferredCustomModel(
    envVars: Record<string, string>,
    customModels: { value: string }[],
  ): string {
    const envPreferred = getCurrentModelFromEnvironment(envVars);
    if (envPreferred && customModels.some((m) => m.value === envPreferred)) {
      return envPreferred;
    }
    return customModels[0].value;
  }

  /** Computes a hash of model and provider base URL environment variables for change detection. */
  private computeEnvHash(envText: string): string {
    const envVars = parseEnvironmentVariables(envText || '');
    const modelKeys = [
      'ANTHROPIC_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    ];
    const providerKeys = ['ANTHROPIC_BASE_URL'];
    const allKeys = [...modelKeys, ...providerKeys];
    const relevantPairs = allKeys
      .filter((key) => envVars[key])
      .map((key) => `${key}=${envVars[key]}`)
      .sort()
      .join('|');
    return relevantPairs;
  }

  /**
   * Reconciles model with environment.
   * Returns { changed, invalidatedConversations } where changed indicates if
   * settings were modified (requiring save), and invalidatedConversations lists
   * conversations that had their sessionId cleared (also requiring save).
   */
  private reconcileModelWithEnvironment(envText: string): {
    changed: boolean;
    invalidatedConversations: Conversation[];
  } {
    const currentHash = this.computeEnvHash(envText);
    const savedHash = this.settings.lastEnvHash || '';

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    // Hash changed - model or provider may have changed.
    // Invalidate session so next query rebuilds full context from history.
    // Note: agentService may not exist yet during initial plugin load.
    this.agentService?.resetSession();

    // Clear sessionId from all conversations since they belong to the old provider.
    // Sessions are provider-specific (contain signed thinking blocks, etc.).
    const invalidatedConversations: Conversation[] = [];
    for (const conv of this.conversations) {
      if (conv.sessionId) {
        conv.sessionId = null;
        invalidatedConversations.push(conv);
      }
    }

    const envVars = parseEnvironmentVariables(envText || '');
    const customModels = getModelsFromEnvironment(envVars);

    if (customModels.length > 0) {
      this.settings.model = this.getPreferredCustomModel(envVars, customModels);
    } else {
      this.settings.model = DEFAULT_CLAUDE_MODELS[0].value;
    }

    this.settings.lastEnvHash = currentHash;
    return { changed: true, invalidatedConversations };
  }

  /** Removes cached images associated with a conversation if not used elsewhere. */
  private cleanupConversationImages(conversation: Conversation): void {
    const cachePaths = new Set<string>();

    for (const message of conversation.messages || []) {
      if (!message.images) continue;
      for (const img of message.images) {
        if (img.cachePath) {
          cachePaths.add(img.cachePath);
        }
      }
    }

    if (cachePaths.size === 0) return;

    const inUseElsewhere = new Set<string>();
    for (const conv of this.conversations) {
      if (conv.id === conversation.id) continue;
      for (const msg of conv.messages || []) {
        if (!msg.images) continue;
        for (const img of msg.images) {
          if (img.cachePath && cachePaths.has(img.cachePath)) {
            inUseElsewhere.add(img.cachePath);
          }
        }
      }
    }

    const deletable = Array.from(cachePaths).filter((p) => !inUseElsewhere.has(p));
    if (deletable.length > 0) {
      deleteCachedImages(this.app, deletable);
    }
  }

  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateDefaultTitle(): string {
    const now = new Date();
    return now.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getConversationPreview(conv: Conversation): string {
    const firstUserMsg = conv.messages.find((m) => m.role === 'user');
    if (!firstUserMsg) return 'New conversation';
    return firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
  }

  /**
   * Lazily loads a conversation by ID if not already in cache.
   * Returns the conversation or null if it doesn't exist.
   */
  async ensureConversationLoaded(id: string): Promise<Conversation | null> {
    // Check if already in cache
    const cached = this.conversations.find((c) => c.id === id);
    if (cached) return cached;

    // Check if it exists in metadata
    const meta = this.conversationMetas.find((m) => m.id === id);
    if (!meta) return null;

    // Load from storage
    const conversation = await this.storage.sessions.loadConversation(id);
    if (conversation) {
      // Backfill lastResponseAt if needed
      if (conversation.lastResponseAt == null && conversation.messages.length > 0) {
        for (let i = conversation.messages.length - 1; i >= 0; i--) {
          const msg = conversation.messages[i];
          if (msg.role === 'assistant') {
            conversation.lastResponseAt = msg.timestamp;
            await this.storage.sessions.saveConversation(conversation);
            break;
          }
        }
      }
      this.conversations.push(conversation);
    }
    return conversation;
  }

  /** Creates a new conversation and sets it as active. */
  async createConversation(): Promise<Conversation> {
    const conversation: Conversation = {
      id: this.generateConversationId(),
      title: this.generateDefaultTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: null,
      messages: [],
    };

    this.conversations.unshift(conversation);
    // Also add to metadata list
    this.conversationMetas.unshift({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: 0,
      preview: 'New conversation',
    });
    this.activeConversationId = conversation.id;
    // Use switchSession to properly recreate query without resume (fresh context)
    await this.agentService.switchSession(null);

    // Save new conversation to session file
    await this.storage.sessions.saveConversation(conversation);
    await this.storage.updateState({ activeConversationId: this.activeConversationId });

    return conversation;
  }

  /** Switches to an existing conversation by ID (lazy loads if needed). */
  async switchConversation(id: string): Promise<Conversation | null> {
    // Use lazy loading to ensure conversation is available
    const conversation = await this.ensureConversationLoaded(id);
    if (!conversation) return null;

    this.activeConversationId = id;
    // Use switchSession to update session state (subprocess stays alive)
    await this.agentService.switchSession(conversation.sessionId);

    await this.storage.updateState({ activeConversationId: this.activeConversationId });
    return conversation;
  }

  /** Deletes a conversation and switches to another if necessary. */
  async deleteConversation(id: string): Promise<void> {
    // Check if it exists in metadata first
    const metaIndex = this.conversationMetas.findIndex((m) => m.id === id);
    if (metaIndex === -1) return;

    // Try to load conversation to clean up images (if not already loaded)
    const conversation = await this.ensureConversationLoaded(id);
    if (conversation) {
      this.cleanupConversationImages(conversation);
    }

    // Remove from loaded conversations cache
    const convIndex = this.conversations.findIndex((c) => c.id === id);
    if (convIndex !== -1) {
      this.conversations.splice(convIndex, 1);
    }

    // Remove from metadata list
    this.conversationMetas.splice(metaIndex, 1);

    // Delete the session file
    await this.storage.sessions.deleteConversation(id);

    if (this.activeConversationId === id) {
      if (this.conversationMetas.length > 0) {
        await this.switchConversation(this.conversationMetas[0].id);
      } else {
        await this.createConversation();
      }
    }
  }

  /** Renames a conversation. */
  async renameConversation(id: string, title: string): Promise<void> {
    const newTitle = title.trim() || this.generateDefaultTitle();
    const now = Date.now();

    // Update in loaded conversations cache if present
    const conversation = this.conversations.find((c) => c.id === id);
    if (conversation) {
      conversation.title = newTitle;
      conversation.updatedAt = now;
      await this.storage.sessions.saveConversation(conversation);
    } else {
      // Load, update, and save
      const conv = await this.ensureConversationLoaded(id);
      if (conv) {
        conv.title = newTitle;
        conv.updatedAt = now;
        await this.storage.sessions.saveConversation(conv);
      }
    }

    // Update metadata list
    const meta = this.conversationMetas.find((m) => m.id === id);
    if (meta) {
      meta.title = newTitle;
      meta.updatedAt = now;
    }
  }

  /** Updates conversation properties (messages, sessionId, etc.). */
  async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    // Must be loaded first - use ensureConversationLoaded if not
    let conversation: Conversation | null = this.conversations.find((c) => c.id === id) ?? null;
    if (!conversation) {
      conversation = await this.ensureConversationLoaded(id);
    }
    if (!conversation) return;

    const now = Date.now();
    Object.assign(conversation, updates, { updatedAt: now });
    await this.storage.sessions.saveConversation(conversation);

    // Update metadata if title or timestamps changed
    const meta = this.conversationMetas.find((m) => m.id === id);
    if (meta) {
      if (updates.title !== undefined) meta.title = updates.title;
      if (updates.lastResponseAt !== undefined) meta.lastResponseAt = updates.lastResponseAt;
      meta.updatedAt = now;
      meta.messageCount = conversation.messages.length;
      // Update preview from first user message
      if (updates.messages !== undefined) {
        meta.preview = this.getConversationPreview(conversation);
      }
    }
  }

  /** Returns the current active conversation. */
  getActiveConversation(): Conversation | null {
    return this.conversations.find((c) => c.id === this.activeConversationId) || null;
  }

  /** Gets a conversation by ID from the in-memory cache. */
  getConversationById(id: string): Conversation | null {
    return this.conversations.find((c) => c.id === id) || null;
  }

  /** Finds an existing empty conversation (no messages) from metadata. */
  findEmptyConversation(): ConversationMeta | null {
    return this.conversationMetas.find((m) => m.messageCount === 0) || null;
  }

  /** Returns conversation metadata list for the history dropdown. */
  getConversationList(): ConversationMeta[] {
    // Use pre-loaded metadata (no need to load full conversations)
    return [...this.conversationMetas];
  }

  /** Returns the active Cortex view from workspace, if open. */
  getView(): CortexView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CORTEX);
    if (leaves.length > 0) {
      return leaves[0].view as CortexView;
    }
    return null;
  }
}
