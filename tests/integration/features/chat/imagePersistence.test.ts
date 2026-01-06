import { WorkspaceLeaf } from 'obsidian';

import type { ChatMessage, ImageAttachment } from '@/core/types';
import { CortexView } from '@/features/chat/CortexView';

function createMockPlugin() {
  return {
    settings: {
      enableBlocklist: true,
      blockedCommands: { unix: [], windows: [] },
      model: 'haiku',
      thinkingBudget: 'off',
      permissionMode: 'yolo',
      permissions: [],
      excludedTags: [],
      mediaFolder: '',
    },
    app: {
      vault: {
        adapter: {
          basePath: '/test/vault',
        },
      },
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([]),
        getRightLeaf: vi.fn().mockReturnValue(null),
        revealLeaf: vi.fn(),
        on: vi.fn(),
      },
      metadataCache: {
        on: vi.fn(),
        getFileCache: vi.fn().mockReturnValue(null),
      },
    },
    agentService: {
      query: vi.fn(),
      cancel: vi.fn(),
      resetSession: vi.fn(),
      setApprovalCallback: vi.fn(),
      setSessionId: vi.fn(),
      getSessionId: vi.fn().mockReturnValue(null),
    },
    saveSettings: vi.fn().mockResolvedValue(undefined),
    createConversation: vi.fn().mockResolvedValue({
      id: 'conv-1',
      title: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: null,
      messages: [],
    }),
    switchConversation: vi.fn().mockResolvedValue(null),
    updateConversation: vi.fn().mockResolvedValue(undefined),
    getActiveEnvironmentVariables: vi.fn().mockReturnValue(''),
  } as any;
}

describe('CortexView persistence', () => {
  it('strips base64 data when persisting messages but keeps references', () => {
    const plugin = createMockPlugin();
    const view = new CortexView(new WorkspaceLeaf(), plugin);

    const images: ImageAttachment[] = [
      {
        id: 'img-1',
        name: 'cached.png',
        mediaType: 'image/png',
        size: 10,
        cachePath: '.cortex-cache/images/cached.png',
        filePath: 'images/cached.png',
        data: 'YmFzZTY0',
        source: 'paste',
      },
    ];

    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'hello',
        timestamp: Date.now(),
        images,
      },
    ];

    view.state.messages = messages;

    const persisted = view.state.getPersistedMessages();

    expect(persisted[0].images?.[0].data).toBeUndefined();
    expect(persisted[0].images?.[0].cachePath).toBe('.cortex-cache/images/cached.png');
    expect(persisted[0].images?.[0].filePath).toBe('images/cached.png');
  });
});
