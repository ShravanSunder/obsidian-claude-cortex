import { BacklinksService } from '@/features/obsidian/BacklinksService';
import type { App, CachedMetadata, MetadataCache, TFile, Vault } from 'obsidian';

// Mock Obsidian App with resolved links
function createMockApp(options: {
  files?: { path: string; basename: string }[];
  resolvedLinks?: Record<string, Record<string, number>>;
  fileCache?: Record<string, CachedMetadata>;
}): App {
  const { files = [], resolvedLinks = {}, fileCache = {} } = options;

  const mockFiles = files.map((f) => ({
    ...f,
    extension: 'md',
  })) as TFile[];

  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string) => {
        const found = files.find((f) => f.path === path);
        return found ? ({ path: found.path } as TFile) : null;
      }),
      getFileByPath: vi.fn((path: string) => {
        const found = files.find((f) => f.path === path);
        return found ? ({ path: found.path, basename: found.basename } as TFile) : null;
      }),
      getMarkdownFiles: vi.fn(() => mockFiles),
    } as unknown as Vault,
    metadataCache: {
      resolvedLinks,
      getFileCache: vi.fn((file: TFile) => fileCache[file.path] ?? null),
      getFirstLinkpathDest: vi.fn((linkpath: string, _sourcePath: string) => {
        // Simple resolution: just look for the file
        const found = files.find(
          (f) => f.path === linkpath || f.basename === linkpath.replace('.md', ''),
        );
        return found ? ({ path: found.path } as TFile) : null;
      }),
    } as unknown as MetadataCache,
  } as unknown as App;
}

describe('BacklinksService', () => {
  describe('getBacklinks', () => {
    it('should find backlinks to a file', () => {
      const app = createMockApp({
        files: [
          { path: 'notes/target.md', basename: 'target' },
          { path: 'notes/source1.md', basename: 'source1' },
          { path: 'notes/source2.md', basename: 'source2' },
        ],
        resolvedLinks: {
          'notes/source1.md': { 'notes/target.md': 1 },
          'notes/source2.md': { 'notes/target.md': 1, 'notes/other.md': 1 },
        },
      });

      const service = new BacklinksService(app);
      const backlinks = service.getBacklinks('notes/target.md');

      expect(backlinks).toHaveLength(2);
      expect(backlinks.map((b) => b.sourceFile)).toContain('notes/source1.md');
      expect(backlinks.map((b) => b.sourceFile)).toContain('notes/source2.md');
    });

    it('should return empty array for file with no backlinks', () => {
      const app = createMockApp({
        files: [{ path: 'notes/lonely.md', basename: 'lonely' }],
        resolvedLinks: {},
      });

      const service = new BacklinksService(app);
      const backlinks = service.getBacklinks('notes/lonely.md');

      expect(backlinks).toHaveLength(0);
    });

    it('should return empty array for non-existent file', () => {
      const app = createMockApp({
        files: [],
        resolvedLinks: {},
      });

      const service = new BacklinksService(app);
      const backlinks = service.getBacklinks('notes/nonexistent.md');

      expect(backlinks).toHaveLength(0);
    });
  });

  describe('getOutgoingLinks', () => {
    it('should find outgoing links from a file', () => {
      const app = createMockApp({
        files: [
          { path: 'notes/source.md', basename: 'source' },
          { path: 'notes/target1.md', basename: 'target1' },
          { path: 'notes/target2.md', basename: 'target2' },
        ],
        fileCache: {
          'notes/source.md': {
            links: [
              {
                link: 'notes/target1.md',
                displayText: 'Target 1',
                position: { start: { line: 1, col: 0 }, end: { line: 1, col: 10 } },
              },
              {
                link: 'notes/target2.md',
                displayText: 'Target 2',
                position: { start: { line: 2, col: 0 }, end: { line: 2, col: 10 } },
              },
            ],
          } as CachedMetadata,
        },
      });

      const service = new BacklinksService(app);
      const outgoing = service.getOutgoingLinks('notes/source.md');

      expect(outgoing).toHaveLength(2);
      expect(outgoing[0].isEmbed).toBe(false);
    });

    it('should include embeds when option is set', () => {
      const app = createMockApp({
        files: [
          { path: 'notes/source.md', basename: 'source' },
          { path: 'notes/embed.md', basename: 'embed' },
        ],
        fileCache: {
          'notes/source.md': {
            links: [],
            embeds: [
              {
                link: 'notes/embed.md',
                displayText: 'Embedded',
                original: '![[embed]]',
                position: {
                  start: { line: 1, col: 0, offset: 0 },
                  end: { line: 1, col: 10, offset: 10 },
                },
              },
            ],
          } as unknown as CachedMetadata,
        },
      });

      const service = new BacklinksService(app);
      const outgoing = service.getOutgoingLinks('notes/source.md', { includeEmbeds: true });

      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].isEmbed).toBe(true);
    });

    it('should return empty array for non-existent file', () => {
      const app = createMockApp({
        files: [],
        fileCache: {},
      });

      const service = new BacklinksService(app);
      const outgoing = service.getOutgoingLinks('notes/nonexistent.md');

      expect(outgoing).toHaveLength(0);
    });
  });

  describe('searchByTag', () => {
    it('should find files with matching tag', () => {
      const app = createMockApp({
        files: [
          { path: 'notes/note1.md', basename: 'note1' },
          { path: 'notes/note2.md', basename: 'note2' },
          { path: 'notes/note3.md', basename: 'note3' },
        ],
        fileCache: {
          'notes/note1.md': {
            frontmatter: { tags: ['project', 'work'] },
          } as CachedMetadata,
          'notes/note2.md': {
            frontmatter: { tags: ['personal'] },
          } as CachedMetadata,
          'notes/note3.md': {
            frontmatter: { tags: ['project'] },
          } as CachedMetadata,
        },
      });

      const service = new BacklinksService(app);
      const results = service.searchByTag('project');

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.filePath)).toContain('notes/note1.md');
      expect(results.map((r) => r.filePath)).toContain('notes/note3.md');
    });

    it('should handle tag with # prefix', () => {
      const app = createMockApp({
        files: [{ path: 'notes/note1.md', basename: 'note1' }],
        fileCache: {
          'notes/note1.md': {
            frontmatter: { tags: ['project'] },
          } as CachedMetadata,
        },
      });

      const service = new BacklinksService(app);
      const results = service.searchByTag('#project');

      expect(results).toHaveLength(1);
    });

    it('should respect limit option', () => {
      const app = createMockApp({
        files: [
          { path: 'note1.md', basename: 'note1' },
          { path: 'note2.md', basename: 'note2' },
          { path: 'note3.md', basename: 'note3' },
        ],
        fileCache: {
          'note1.md': { frontmatter: { tags: ['common'] } } as CachedMetadata,
          'note2.md': { frontmatter: { tags: ['common'] } } as CachedMetadata,
          'note3.md': { frontmatter: { tags: ['common'] } } as CachedMetadata,
        },
      });

      const service = new BacklinksService(app);
      const results = service.searchByTag('common', { limit: 2 });

      expect(results).toHaveLength(2);
    });

    it('should include nested tags when option is set', () => {
      const app = createMockApp({
        files: [
          { path: 'note1.md', basename: 'note1' },
          { path: 'note2.md', basename: 'note2' },
        ],
        fileCache: {
          'note1.md': { frontmatter: { tags: ['project/active'] } } as CachedMetadata,
          'note2.md': { frontmatter: { tags: ['project'] } } as CachedMetadata,
        },
      });

      const service = new BacklinksService(app);
      const results = service.searchByTag('project', { includeNested: true });

      expect(results).toHaveLength(2);
    });
  });

  describe('getAllTags', () => {
    it('should return all tags with counts', () => {
      const app = createMockApp({
        files: [
          { path: 'note1.md', basename: 'note1' },
          { path: 'note2.md', basename: 'note2' },
        ],
        fileCache: {
          'note1.md': { frontmatter: { tags: ['project', 'work'] } } as CachedMetadata,
          'note2.md': { frontmatter: { tags: ['project', 'personal'] } } as CachedMetadata,
        },
      });

      const service = new BacklinksService(app);
      const tags = service.getAllTags();

      expect(tags.get('project')).toBe(2);
      expect(tags.get('work')).toBe(1);
      expect(tags.get('personal')).toBe(1);
    });

    it('should return empty map for vault with no tags', () => {
      const app = createMockApp({
        files: [{ path: 'note1.md', basename: 'note1' }],
        fileCache: {
          'note1.md': {} as CachedMetadata,
        },
      });

      const service = new BacklinksService(app);
      const tags = service.getAllTags();

      expect(tags.size).toBe(0);
    });
  });
});
