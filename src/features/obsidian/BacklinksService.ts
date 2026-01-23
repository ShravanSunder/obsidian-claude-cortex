/**
 * Backlinks Service
 *
 * Provides access to Obsidian's graph relationships via metadataCache.
 * Enables exploration of note connections: backlinks, outgoing links, and tag searches.
 */

import type { App, CachedMetadata, TFile } from 'obsidian';

/** A backlink entry representing a note that links to a target file. */
export interface BacklinkEntry {
  sourceFile: string;
  lineNumber?: number;
  displayText?: string;
}

/** An outgoing link entry representing a link from the source file. */
export interface OutgoingLinkEntry {
  targetFile: string;
  isEmbed: boolean;
  displayText?: string;
  exists: boolean;
}

/** Result of a tag search. */
export interface TagSearchResult {
  filePath: string;
  title: string;
}

/**
 * Service for exploring vault graph relationships.
 */
export class BacklinksService {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Get all files that link TO the specified file (backlinks).
   */
  getBacklinks(filePath: string, options?: { includeContext?: boolean }): BacklinkEntry[] {
    // Verify the file exists
    const tfile = this.app.vault.getFileByPath(filePath);
    if (!tfile) return [];

    const backlinks: BacklinkEntry[] = [];

    // Use resolvedLinks from metadataCache for efficient lookup
    const resolvedLinks = this.app.metadataCache.resolvedLinks;

    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      if (links[filePath]) {
        const entry: BacklinkEntry = { sourceFile: sourcePath };

        if (options?.includeContext) {
          // Get link position from cache if available
          const sourceFile = this.app.vault.getFileByPath(sourcePath);
          if (sourceFile) {
            const cache = this.app.metadataCache.getFileCache(sourceFile);
            if (cache?.links) {
              for (const link of cache.links) {
                const resolvedPath = this.app.metadataCache.getFirstLinkpathDest(
                  link.link,
                  sourcePath,
                );
                if (resolvedPath?.path === filePath) {
                  entry.lineNumber = link.position.start.line + 1;
                  entry.displayText = link.displayText;
                  break;
                }
              }
            }
          }
        }

        backlinks.push(entry);
      }
    }

    return backlinks;
  }

  /**
   * Get all files that the specified file links TO (outgoing links).
   */
  getOutgoingLinks(filePath: string, options?: { includeEmbeds?: boolean }): OutgoingLinkEntry[] {
    const file = this.app.vault.getFileByPath(filePath);
    if (!file) return [];

    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return [];

    const outgoing: OutgoingLinkEntry[] = [];
    const includeEmbeds = options?.includeEmbeds ?? true;

    // Regular links
    if (cache.links) {
      for (const link of cache.links) {
        const resolved = this.app.metadataCache.getFirstLinkpathDest(link.link, filePath);
        outgoing.push({
          targetFile: resolved?.path ?? link.link,
          isEmbed: false,
          displayText: link.displayText,
          exists: !!resolved,
        });
      }
    }

    // Embeds (transclusions)
    if (includeEmbeds && cache.embeds) {
      for (const embed of cache.embeds) {
        const resolved = this.app.metadataCache.getFirstLinkpathDest(embed.link, filePath);
        outgoing.push({
          targetFile: resolved?.path ?? embed.link,
          isEmbed: true,
          displayText: embed.displayText,
          exists: !!resolved,
        });
      }
    }

    return outgoing;
  }

  /**
   * Search for files by tag.
   */
  searchByTag(
    tag: string,
    options?: { includeNested?: boolean; limit?: number },
  ): TagSearchResult[] {
    const normalizedTag = tag.replace(/^#/, '').toLowerCase();
    const includeNested = options?.includeNested ?? false;
    const limit = options?.limit ?? 100;
    const results: TagSearchResult[] = [];

    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (results.length >= limit) break;

      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;

      if (this.fileHasTag(cache, normalizedTag, includeNested)) {
        results.push({
          filePath: file.path,
          title: this.getFileTitle(file, cache),
        });
      }
    }

    return results;
  }

  /**
   * Get all tags used in the vault with their counts.
   */
  getAllTags(): Map<string, number> {
    const tagCounts = new Map<string, number>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;

      const tags = this.extractTags(cache);
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return tagCounts;
  }

  /**
   * Check if a file has a specific tag.
   */
  private fileHasTag(cache: CachedMetadata, tag: string, includeNested: boolean): boolean {
    const fileTags = this.extractTags(cache);

    for (const fileTag of fileTags) {
      if (includeNested) {
        if (fileTag === tag || fileTag.startsWith(tag + '/')) {
          return true;
        }
      } else if (fileTag === tag) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract all tags from a file's cache.
   */
  private extractTags(cache: CachedMetadata): string[] {
    const tags: string[] = [];

    // Frontmatter tags
    if (cache.frontmatter?.tags) {
      const fmTags = cache.frontmatter.tags;
      if (Array.isArray(fmTags)) {
        tags.push(...fmTags.map((t: string) => String(t).replace(/^#/, '').toLowerCase()));
      } else if (typeof fmTags === 'string') {
        tags.push(fmTags.replace(/^#/, '').toLowerCase());
      }
    }

    // Inline tags
    if (cache.tags) {
      tags.push(...cache.tags.map((t) => t.tag.replace(/^#/, '').toLowerCase()));
    }

    return tags;
  }

  /**
   * Get the title of a file (from frontmatter or filename).
   */
  private getFileTitle(file: TFile, cache: CachedMetadata): string {
    if (cache.frontmatter?.title) {
      return String(cache.frontmatter.title);
    }
    return file.basename;
  }
}
