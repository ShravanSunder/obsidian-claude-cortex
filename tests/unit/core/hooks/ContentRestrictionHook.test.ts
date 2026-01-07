import { isPathExcluded } from '@/core/hooks/ContentRestrictionHook';
import type { App, CachedMetadata, TFile, Vault } from 'obsidian';

// Mock Obsidian App
function createMockApp(files: Map<string, { cache: CachedMetadata | null }> = new Map()): App {
  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string) => {
        return files.has(path) ? ({ path } as TFile) : null;
      }),
      getFileByPath: vi.fn((path: string) => {
        return files.has(path) ? ({ path } as TFile) : null;
      }),
      adapter: {
        constructor: class MockAdapter {},
      },
    } as unknown as Vault,
    metadataCache: {
      getFileCache: vi.fn((file: TFile) => {
        const data = files.get(file.path);
        return data?.cache ?? null;
      }),
    },
  } as unknown as App;
}

describe('ContentRestrictionHook', () => {
  describe('isPathExcluded', () => {
    it('should return true for paths in excluded folders', () => {
      const app = createMockApp();
      const excludedFolders = ['private', 'secret/docs'];

      expect(isPathExcluded('private/note.md', excludedFolders, [], app)).toBe(true);
      expect(isPathExcluded('private/subfolder/note.md', excludedFolders, [], app)).toBe(true);
      expect(isPathExcluded('secret/docs/file.md', excludedFolders, [], app)).toBe(true);
    });

    it('should return false for paths not in excluded folders', () => {
      const app = createMockApp();
      const excludedFolders = ['private', 'secret'];

      expect(isPathExcluded('public/note.md', excludedFolders, [], app)).toBe(false);
      expect(isPathExcluded('notes/private-note.md', excludedFolders, [], app)).toBe(false);
      expect(isPathExcluded('secret-project/doc.md', excludedFolders, [], app)).toBe(false);
    });

    it('should handle empty excluded folders array', () => {
      const app = createMockApp();
      expect(isPathExcluded('any/path.md', [], [], app)).toBe(false);
    });

    it('should normalize paths with leading slashes', () => {
      const app = createMockApp();
      const excludedFolders = ['private'];

      expect(isPathExcluded('/private/note.md', excludedFolders, [], app)).toBe(true);
    });

    it('should check excluded tags for markdown files', () => {
      const files = new Map<string, { cache: CachedMetadata | null }>([
        [
          'public/note.md',
          {
            cache: {
              frontmatter: {
                tags: ['private', 'work'],
              },
            } as CachedMetadata,
          },
        ],
        [
          'public/other.md',
          {
            cache: {
              frontmatter: {
                tags: ['public'],
              },
            } as CachedMetadata,
          },
        ],
      ]);
      const app = createMockApp(files);

      expect(isPathExcluded('public/note.md', [], ['private'], app)).toBe(true);
      expect(isPathExcluded('public/other.md', [], ['private'], app)).toBe(false);
    });

    it('should handle nested tags', () => {
      const files = new Map<string, { cache: CachedMetadata | null }>([
        [
          'note.md',
          {
            cache: {
              frontmatter: {
                tags: ['work/confidential'],
              },
            } as CachedMetadata,
          },
        ],
      ]);
      const app = createMockApp(files);

      expect(isPathExcluded('note.md', [], ['work'], app)).toBe(true);
    });

    it('should not check tags for non-markdown files', () => {
      const files = new Map<string, { cache: CachedMetadata | null }>([
        [
          'data.json',
          {
            cache: {
              frontmatter: {
                tags: ['private'],
              },
            } as CachedMetadata,
          },
        ],
      ]);
      const app = createMockApp(files);

      // Non-markdown files skip tag checking
      expect(isPathExcluded('data.json', [], ['private'], app)).toBe(false);
    });
  });
});
