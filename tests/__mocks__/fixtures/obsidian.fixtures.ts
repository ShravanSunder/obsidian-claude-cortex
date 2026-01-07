/**
 * Typed Vitest fixtures for Obsidian API mocks.
 *
 * Factory functions that return properly typed mocks instead of using `as` casts.
 * Import and use these in tests to reduce type coercion.
 */

import type {
  App,
  CachedMetadata,
  FileStats,
  FrontMatterCache,
  LinkCache,
  MetadataCache,
  TFile,
  TFolder,
  Vault,
  Workspace,
  WorkspaceLeaf,
} from 'obsidian';
import { vi } from 'vitest';

/**
 * Create a mock TFile with type safety.
 * All required TFile properties are included with sensible defaults.
 */
export function createMockTFile(
  overrides?: Partial<{
    path: string;
    name: string;
    basename: string;
    extension: string;
    parent: TFolder | null;
    stat: FileStats;
  }>,
): TFile {
  const path = overrides?.path ?? 'test.md';
  const name = overrides?.name ?? path.split('/').pop() ?? 'test.md';
  const basename = overrides?.basename ?? name.replace(/\.[^.]+$/, '');
  const extension = overrides?.extension ?? name.split('.').pop() ?? 'md';

  return {
    path,
    name,
    basename,
    extension,
    stat: overrides?.stat ?? { ctime: Date.now(), mtime: Date.now(), size: 100 },
    vault: {} as Vault,
    parent: overrides?.parent ?? null,
  } satisfies TFile;
}

/**
 * Create a mock TFolder with type safety.
 */
export function createMockTFolder(
  overrides?: Partial<{
    path: string;
    name: string;
    parent: TFolder | null;
    children: (TFile | TFolder)[];
  }>,
): TFolder {
  const path = overrides?.path ?? 'folder';
  const name = overrides?.name ?? path.split('/').pop() ?? 'folder';

  return {
    path,
    name,
    parent: overrides?.parent ?? null,
    children: overrides?.children ?? [],
    vault: {} as Vault,
    isRoot: () => path === '/',
  } satisfies TFolder;
}

/**
 * Create mock FileStats.
 */
export function createMockFileStats(
  overrides?: Partial<{
    ctime: number;
    mtime: number;
    size: number;
  }>,
): FileStats {
  return {
    ctime: overrides?.ctime ?? Date.now(),
    mtime: overrides?.mtime ?? Date.now(),
    size: overrides?.size ?? 100,
  } satisfies FileStats;
}

/**
 * Create a mock CachedMetadata with type safety.
 */
export function createMockMetadata(
  overrides?: Partial<{
    links: LinkCache[];
    embeds: LinkCache[];
    frontmatter: FrontMatterCache;
  }>,
): CachedMetadata {
  return {
    links: overrides?.links ?? [],
    embeds: overrides?.embeds ?? [],
    frontmatter: overrides?.frontmatter,
  } satisfies CachedMetadata;
}

/**
 * Create a mock LinkCache.
 */
export function createMockLinkCache(
  overrides?: Partial<{
    link: string;
    original: string;
    displayText: string;
    position: {
      start: { line: number; col: number; offset: number };
      end: { line: number; col: number; offset: number };
    };
  }>,
): LinkCache {
  const link = overrides?.link ?? 'target';
  return {
    link,
    original: overrides?.original ?? `[[${link}]]`,
    displayText: overrides?.displayText ?? link,
    position: overrides?.position ?? {
      start: { line: 0, col: 0, offset: 0 },
      end: { line: 0, col: link.length + 4, offset: link.length + 4 },
    },
  } satisfies LinkCache;
}

/**
 * Options for creating a mock Vault.
 */
export interface MockVaultOptions {
  basePath?: string;
  files?: Record<string, string>;
  resolvedLinks?: Record<string, Record<string, number>>;
}

/**
 * Create a mock Vault with common methods stubbed.
 */
export function createMockVault(options?: MockVaultOptions): Vault {
  const basePath = options?.basePath ?? '/mock/vault';
  const files = options?.files ?? {};
  const createdFiles: Record<string, string> = {};

  return {
    adapter: {
      basePath,
      exists: vi.fn(async (path: string) => path in files || path in createdFiles),
      read: vi.fn(async (path: string) => files[path] ?? createdFiles[path] ?? ''),
      write: vi.fn(async (path: string, content: string) => {
        createdFiles[path] = content;
      }),
      list: vi.fn(async () => ({ files: Object.keys(files), folders: [] })),
      mkdir: vi.fn(),
      remove: vi.fn(),
      rename: vi.fn(),
      stat: vi.fn(),
      copy: vi.fn(),
      readBinary: vi.fn(),
      writeBinary: vi.fn(),
    },
    getAbstractFileByPath: vi.fn((path: string) => {
      if (files[path] || createdFiles[path]) {
        return createMockTFile({ path });
      }
      return null;
    }),
    getFileByPath: vi.fn((path: string) => {
      if (files[path] || createdFiles[path]) {
        return createMockTFile({ path });
      }
      return null;
    }),
    getMarkdownFiles: vi.fn(() =>
      Object.keys(files)
        .filter((p) => p.endsWith('.md'))
        .map((p) => createMockTFile({ path: p })),
    ),
    read: vi.fn(async (file: TFile) => files[file.path] ?? createdFiles[file.path] ?? ''),
    cachedRead: vi.fn(async (file: TFile) => files[file.path] ?? createdFiles[file.path] ?? ''),
    modify: vi.fn(async (file: TFile, content: string) => {
      createdFiles[file.path] = content;
    }),
    create: vi.fn(async (path: string, content: string) => {
      createdFiles[path] = content;
      return createMockTFile({ path });
    }),
    delete: vi.fn(),
    rename: vi.fn(),
    copy: vi.fn(),
    getAllLoadedFiles: vi.fn(() => []),
    getRoot: vi.fn(() => createMockTFolder({ path: '/' })),
  } as unknown as Vault;
}

/**
 * Options for creating a mock MetadataCache.
 */
export interface MockMetadataCacheOptions {
  resolvedLinks?: Record<string, Record<string, number>>;
  fileCache?: Record<string, CachedMetadata>;
  files?: { path: string; basename: string }[];
}

/**
 * Create a mock MetadataCache with common methods stubbed.
 */
export function createMockMetadataCache(options?: MockMetadataCacheOptions): MetadataCache {
  const { resolvedLinks = {}, fileCache = {}, files = [] } = options ?? {};

  return {
    resolvedLinks,
    getFileCache: vi.fn((file: TFile) => fileCache[file.path] ?? null),
    getCache: vi.fn((path: string) => fileCache[path] ?? null),
    getFirstLinkpathDest: vi.fn((linkpath: string, _sourcePath: string) => {
      const found = files.find(
        (f) => f.path === linkpath || f.basename === linkpath.replace('.md', ''),
      );
      return found ? createMockTFile({ path: found.path, basename: found.basename }) : null;
    }),
    on: vi.fn(),
    off: vi.fn(),
    trigger: vi.fn(),
  } as unknown as MetadataCache;
}

/**
 * Create a mock WorkspaceLeaf.
 */
export function createMockWorkspaceLeaf(): WorkspaceLeaf {
  return {
    setViewState: vi.fn().mockResolvedValue(undefined),
    getViewState: vi.fn().mockReturnValue({}),
    view: null,
    containerEl: document.createElement('div'),
  } as unknown as WorkspaceLeaf;
}

/**
 * Create a mock Workspace.
 */
export function createMockWorkspace(): Workspace {
  const mockLeaf = createMockWorkspaceLeaf();

  return {
    getLeavesOfType: vi.fn().mockReturnValue([]),
    getRightLeaf: vi.fn().mockReturnValue(mockLeaf),
    getLeftLeaf: vi.fn().mockReturnValue(mockLeaf),
    revealLeaf: vi.fn(),
    getActiveViewOfType: vi.fn().mockReturnValue(null),
    getActiveFile: vi.fn().mockReturnValue(null),
    on: vi.fn(),
    off: vi.fn(),
    trigger: vi.fn(),
    activeLeaf: mockLeaf,
  } as unknown as Workspace;
}

/**
 * Options for creating a mock App.
 */
export interface MockAppOptions {
  basePath?: string;
  files?: Record<string, string>;
  resolvedLinks?: Record<string, Record<string, number>>;
  fileCache?: Record<string, CachedMetadata>;
}

/**
 * Create a mock Obsidian App with all common services stubbed.
 * This is the main factory function for creating test mocks.
 */
export function createMockApp(options?: MockAppOptions): App {
  const { basePath, files = {}, resolvedLinks = {}, fileCache = {} } = options ?? {};

  // Convert files Record to array format for MetadataCache
  const filesList = Object.keys(files).map((path) => ({
    path,
    basename:
      path
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') ?? '',
  }));

  return {
    vault: createMockVault({ basePath, files }),
    metadataCache: createMockMetadataCache({
      resolvedLinks,
      fileCache,
      files: filesList,
    }),
    workspace: createMockWorkspace(),
    keymap: {},
    scope: {},
    fileManager: {},
    lastEvent: null,
  } as unknown as App;
}
