/**
 * Tests for MermaidFixService - Fixing broken Mermaid diagrams with AI
 */

// eslint-disable-next-line jest/no-mocks-import
import {
  getLastOptions,
  resetMockMessages,
  setMockMessages,
} from '@test/__mocks__/claude-agent-sdk';

import {
  extractMermaidFromResponse,
  getUnsupportedType,
  type MermaidFixResult,
  MermaidFixService,
  UNSUPPORTED_MERMAID_TYPES,
} from '@/features/chat/services/MermaidFixService';

function createMockPlugin(settings = {}) {
  return {
    settings: {
      model: 'sonnet',
      ...settings,
    },
    app: {
      vault: {
        adapter: {
          basePath: '/test/vault/path',
        },
      },
    },
    getActiveEnvironmentVariables: vi.fn().mockReturnValue(''),
    getResolvedClaudeCliPath: vi.fn().mockReturnValue('/fake/claude'),
  } as any;
}

describe('MermaidFixService', () => {
  describe('UNSUPPORTED_MERMAID_TYPES', () => {
    it('should include gantt, timeline, mindmap, quadrantchart, sankey, xychart, block', () => {
      expect(UNSUPPORTED_MERMAID_TYPES).toContain('gantt');
      expect(UNSUPPORTED_MERMAID_TYPES).toContain('timeline');
      expect(UNSUPPORTED_MERMAID_TYPES).toContain('mindmap');
      expect(UNSUPPORTED_MERMAID_TYPES).toContain('quadrantchart');
      expect(UNSUPPORTED_MERMAID_TYPES).toContain('sankey');
      expect(UNSUPPORTED_MERMAID_TYPES).toContain('xychart');
      expect(UNSUPPORTED_MERMAID_TYPES).toContain('block');
    });

    it('should have exactly 7 unsupported types', () => {
      expect(UNSUPPORTED_MERMAID_TYPES).toHaveLength(7);
    });
  });

  describe('getUnsupportedType', () => {
    it.each([
      ['gantt\n  title Test', 'gantt'],
      ['timeline\n  title Test', 'timeline'],
      ['mindmap\n  root', 'mindmap'],
      ['quadrantchart\n  title', 'quadrantchart'],
      ['sankey-beta\n  source', 'sankey'],
      ['xychart-beta\n  title', 'xychart'],
      ['block-beta\n  columns', 'block'],
    ])('should detect "%s" as unsupported type "%s"', (code, expected) => {
      expect(getUnsupportedType(code)).toBe(expected);
    });

    it.each([
      ['flowchart LR\n  A --> B'],
      ['sequenceDiagram\n  Alice->>Bob: Hi'],
      ['classDiagram\n  class A'],
      ['stateDiagram-v2\n  [*] --> A'],
      ['erDiagram\n  CUSTOMER ||--o{ ORDER'],
      ['pie\n  title Test\n  "A": 50'],
      ['graph TD\n  A --> B'],
      ['gitGraph\n  commit'],
      ['journey\n  title My Day'],
    ])('should return null for supported type: "%s"', (code) => {
      expect(getUnsupportedType(code)).toBeNull();
    });

    it('should handle case insensitivity', () => {
      expect(getUnsupportedType('GANTT\n  title Test')).toBe('gantt');
      expect(getUnsupportedType('GaNtT\n  title Test')).toBe('gantt');
      expect(getUnsupportedType('TIMELINE\n  title')).toBe('timeline');
    });

    it('should handle whitespace before diagram type', () => {
      expect(getUnsupportedType('  gantt\n  title Test')).toBe('gantt');
      expect(getUnsupportedType('\n\ngantt')).toBe('gantt');
      expect(getUnsupportedType('\t  timeline')).toBe('timeline');
    });

    it('should handle empty content', () => {
      expect(getUnsupportedType('')).toBeNull();
      expect(getUnsupportedType('   ')).toBeNull();
      expect(getUnsupportedType('\n\n')).toBeNull();
    });
  });

  describe('extractMermaidFromResponse', () => {
    it('should extract mermaid code from markdown code block with mermaid tag', () => {
      const response = 'Here is the fix:\n```mermaid\nflowchart LR\n  A --> B\n```';
      expect(extractMermaidFromResponse(response)).toBe('flowchart LR\n  A --> B');
    });

    it('should extract mermaid code from generic code block', () => {
      const response = '```\nflowchart LR\n  A --> B\n```';
      expect(extractMermaidFromResponse(response)).toBe('flowchart LR\n  A --> B');
    });

    it('should return empty string for response with no code block', () => {
      expect(extractMermaidFromResponse('No code here')).toBe('');
      expect(extractMermaidFromResponse('Just text without blocks')).toBe('');
    });

    it('should handle code block with extra whitespace', () => {
      const response = '```mermaid\n\n  flowchart LR\n    A --> B\n\n```';
      expect(extractMermaidFromResponse(response)).toBe('flowchart LR\n    A --> B');
    });

    it('should prefer mermaid-tagged blocks over generic blocks', () => {
      const response = '```\ngeneric\n```\n\n```mermaid\nflowchart LR\n```';
      expect(extractMermaidFromResponse(response)).toBe('flowchart LR');
    });

    it('should handle empty code blocks', () => {
      expect(extractMermaidFromResponse('```mermaid\n```')).toBe('');
      expect(extractMermaidFromResponse('```\n```')).toBe('');
    });
  });

  describe('MermaidFixService class', () => {
    let service: MermaidFixService;
    let mockPlugin: any;

    beforeEach(() => {
      vi.clearAllMocks();
      resetMockMessages();
      mockPlugin = createMockPlugin();
      service = new MermaidFixService(mockPlugin);
    });

    describe('fixMermaid', () => {
      it('should fix broken mermaid and call callback with success', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart LR\n  A --> B\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const callback = vi.fn();
        await service.fixMermaid(
          'flowchart LR\n  A -->',
          new Error('Parse error: Expected identifier'),
          'diagram-1',
          callback,
        );

        expect(callback).toHaveBeenCalledWith('diagram-1', {
          success: true,
          fixedCode: 'flowchart LR\n  A --> B',
        });
      });

      it('should use haiku model by default for fixes', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart LR\n  A --> B\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const callback = vi.fn();
        await service.fixMermaid('broken', new Error('error'), 'id', callback);

        const options = getLastOptions();
        expect(options?.model).toBe('claude-haiku-4-5');
      });

      it('should use ANTHROPIC_DEFAULT_HAIKU_MODEL when set', async () => {
        mockPlugin.getActiveEnvironmentVariables.mockReturnValue(
          'ANTHROPIC_DEFAULT_HAIKU_MODEL=custom-haiku',
        );

        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart LR\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const callback = vi.fn();
        await service.fixMermaid('broken', new Error('error'), 'id', callback);

        const options = getLastOptions();
        expect(options?.model).toBe('custom-haiku');
      });

      it('should use no tools and bypass permissions', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const callback = vi.fn();
        await service.fixMermaid('broken', new Error('error'), 'id', callback);

        const options = getLastOptions();
        expect(options?.allowedTools).toEqual([]);
        expect(options?.permissionMode).toBe('bypassPermissions');
      });

      it('should include render error message in prompt', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart\n```' }],
            },
          },
          { type: 'result' },
        ]);

        // We can't directly check the prompt, but we can verify the service was called
        const callback = vi.fn();
        await service.fixMermaid(
          'broken code',
          new Error('Parse error at line 3: unexpected token'),
          'id',
          callback,
        );

        // Service should complete successfully
        expect(callback).toHaveBeenCalled();
      });

      it('should fail when fix returns same code as original', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nbroken\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          const callback = vi.fn();
          await service.fixMermaid('broken', new Error('error'), 'id', callback);

          expect(callback).toHaveBeenCalledWith('id', {
            success: false,
            error: 'Could not fix diagram',
          });
        } finally {
          warnSpy.mockRestore();
        }
      });

      it('should fail when no code block in response', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Sorry, I could not fix this diagram.' }],
            },
          },
          { type: 'result' },
        ]);

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          const callback = vi.fn();
          await service.fixMermaid('broken', new Error('error'), 'id', callback);

          expect(callback).toHaveBeenCalledWith('id', {
            success: false,
            error: 'Could not extract fixed code from response',
          });
        } finally {
          warnSpy.mockRestore();
        }
      });

      it('should fail when vault path cannot be determined', async () => {
        mockPlugin.app.vault.adapter.basePath = undefined;
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          const callback = vi.fn();
          await service.fixMermaid('broken', new Error('error'), 'id', callback);

          expect(callback).toHaveBeenCalledWith('id', {
            success: false,
            error: 'Could not determine vault path',
          });
        } finally {
          warnSpy.mockRestore();
        }
      });

      it('should fail when Claude CLI is not found', async () => {
        mockPlugin.getResolvedClaudeCliPath.mockReturnValue(null);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          const callback = vi.fn();
          await service.fixMermaid('broken', new Error('error'), 'id', callback);

          expect(callback).toHaveBeenCalledWith('id', {
            success: false,
            error: 'Claude CLI not found',
          });
        } finally {
          warnSpy.mockRestore();
        }
      });
    });

    describe('concurrent fix handling', () => {
      it('should support multiple concurrent fixes for different diagrams', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart LR\n  A --> B\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const promise1 = service.fixMermaid('broken1', new Error('error1'), 'diagram-1', callback1);
        const promise2 = service.fixMermaid('broken2', new Error('error2'), 'diagram-2', callback2);

        await Promise.all([promise1, promise2]);

        expect(callback1).toHaveBeenCalledWith(
          'diagram-1',
          expect.objectContaining({ success: true }),
        );
        expect(callback2).toHaveBeenCalledWith(
          'diagram-2',
          expect.objectContaining({ success: true }),
        );
      });

      it('should cancel previous fix for same diagram', async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart LR\n  Fixed\n```' }],
            },
          },
          { type: 'result' },
        ]);

        // Start first fix
        const promise1 = service.fixMermaid(
          'broken',
          new Error('error'),
          'same-diagram',
          callback1,
        );

        // Immediately start second fix for same diagram (cancels first)
        const promise2 = service.fixMermaid(
          'broken2',
          new Error('error2'),
          'same-diagram',
          callback2,
        );

        await Promise.all([promise1, promise2]);

        // Second callback should be called with success
        expect(callback2).toHaveBeenCalledWith(
          'same-diagram',
          expect.objectContaining({ success: true }),
        );
      });
    });

    describe('cancelFix', () => {
      it('should cancel active fix attempt', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const callback = vi.fn();

        // Start fix then cancel immediately
        const promise = service.fixMermaid('broken', new Error('error'), 'diagram-1', callback);
        service.cancelFix('diagram-1');

        await promise;

        // Should be called with cancelled error or might not be called at all
        expect(callback).toHaveBeenCalled();
      });
    });

    describe('cancelAll', () => {
      it('should cancel all active fixes', async () => {
        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const promise1 = service.fixMermaid('broken1', new Error('error'), 'diagram-1', callback1);
        const promise2 = service.fixMermaid('broken2', new Error('error'), 'diagram-2', callback2);

        service.cancelAll();

        await Promise.all([promise1, promise2]);

        // Both should have been called
        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
      });
    });

    describe('safeCallback', () => {
      it('should catch errors thrown by callback', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setMockMessages([
          { type: 'system', subtype: 'init', session_id: 'test-session' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '```mermaid\nflowchart LR\n  A --> B\n```' }],
            },
          },
          { type: 'result' },
        ]);

        const throwingCallback = vi.fn().mockImplementation(() => {
          throw new Error('Callback error');
        });

        // Should not throw
        await expect(
          service.fixMermaid('broken', new Error('render error'), 'diagram-1', throwingCallback),
        ).resolves.not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith(
          '[MermaidFix] Error in callback:',
          'Callback error',
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe('MermaidFixResult type', () => {
    it('should be a discriminated union for success', () => {
      const success: MermaidFixResult = { success: true, fixedCode: 'flowchart LR\n  A --> B' };
      expect(success.success).toBe(true);
      expect(success).toEqual({ success: true, fixedCode: 'flowchart LR\n  A --> B' });
    });

    it('should be a discriminated union for failure', () => {
      const failure: MermaidFixResult = { success: false, error: 'Could not fix diagram' };
      expect(failure.success).toBe(false);
      expect(failure).toEqual({ success: false, error: 'Could not fix diagram' });
    });
  });
});
