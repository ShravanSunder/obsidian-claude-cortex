import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to define mocks before vi.mock is hoisted
const { mockExistsSync, mockStatSync, mockReadFileSync, mockHomedir } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockStatSync: vi.fn<(path: string) => { size: number }>(),
  mockReadFileSync: vi.fn<(path: string) => string>(),
  mockHomedir: vi.fn<() => string>(),
}));

// Mock fs module at the module level for ESM compatibility
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
    statSync: mockStatSync,
    readFileSync: mockReadFileSync,
  };
});

// Mock os module for homedir
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: mockHomedir,
  };
});

import { createFileHashPostHook, createFileHashPreHook } from '@/core/hooks/DiffTrackingHooks';

describe('DiffTrackingHooks path normalization', () => {
  const vaultPath = '/vault';

  beforeEach(() => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 10 });
    mockReadFileSync.mockReturnValue('original');
  });

  afterEach(() => {
    mockExistsSync.mockReset();
    mockStatSync.mockReset();
    mockReadFileSync.mockReset();
    mockHomedir.mockReset();
  });

  it('expands home paths before checking filesystem in pre-hook', async () => {
    mockHomedir.mockReturnValue('/home/test');
    const originalContents = new Map();
    const hook = createFileHashPreHook(vaultPath, originalContents);

    await hook.hooks[0](
      {
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript',
        cwd: vaultPath,
        tool_name: 'Write',
        tool_input: { file_path: '~/notes/a.md' },
      } as Parameters<(typeof hook.hooks)[0]>[0],
      'tool-1',
      { signal: new AbortController().signal },
    );

    expect(mockExistsSync).toHaveBeenCalledWith('/home/test/notes/a.md');
  });

  it('expands environment variables before reading filesystem in post-hook', async () => {
    const envKey = 'CLAUDIAN_DIFF_TEST_PATH';
    const originalValue = process.env[envKey];
    process.env[envKey] = '/tmp/claudian';

    mockReadFileSync.mockReturnValue('new');

    const originalContents = new Map();
    originalContents.set('tool-2', { filePath: `$${envKey}/notes/a.md`, content: 'old' });
    const pendingDiffData = new Map();
    const hook = createFileHashPostHook(vaultPath, originalContents, pendingDiffData);

    await hook.hooks[0](
      {
        hook_event_name: 'PostToolUse',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript',
        cwd: vaultPath,
        tool_name: 'Write',
        tool_input: { file_path: `$${envKey}/notes/a.md` },
        tool_response: 'File written',
        tool_use_id: 'tool-2',
        tool_result: { is_error: false },
      } as unknown as Parameters<(typeof hook.hooks)[0]>[0],
      'tool-2',
      { signal: new AbortController().signal },
    );

    expect(mockExistsSync).toHaveBeenCalledWith('/tmp/claudian/notes/a.md');
    expect(pendingDiffData.get('tool-2')).toEqual({
      filePath: `$${envKey}/notes/a.md`,
      originalContent: 'old',
      newContent: 'new',
    });

    if (originalValue === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = originalValue;
    }
  });
});
