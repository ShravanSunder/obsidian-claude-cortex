/**
 * Content Restriction Hook
 *
 * PreToolUse hook for enforcing excludedFolders and excludedTags as security boundaries.
 * Blocks Claude from reading files in excluded folders or with excluded tags.
 */

import type { HookCallbackMatcher } from '@anthropic-ai/claude-agent-sdk';
import type { App } from 'obsidian';

import { getPathFromToolInput } from '../tools/toolInput';
import { isFileTool } from '../tools/toolNames';

/** Context for content restriction checking. */
export interface ContentRestrictionContext {
  app: App;
  vaultPath: string;
  getExcludedFolders: () => string[];
  getExcludedTags: () => string[];
}

/**
 * Normalize a path for comparison (forward slashes, no leading/trailing slashes).
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '');
}

/**
 * Convert an absolute path to a vault-relative path.
 */
function toVaultRelativePath(absolutePath: string, vaultPath: string): string {
  const normalizedAbsolute = normalizePath(absolutePath);
  const normalizedVault = normalizePath(vaultPath);

  if (normalizedAbsolute.startsWith(normalizedVault + '/')) {
    return normalizedAbsolute.slice(normalizedVault.length + 1);
  }
  return normalizedAbsolute;
}

/**
 * Check if a path is within an excluded folder.
 */
function isInExcludedFolder(filePath: string, excludedFolders: string[]): string | null {
  const normalized = normalizePath(filePath);

  for (const folder of excludedFolders) {
    const normalizedFolder = normalizePath(folder);
    if (!normalizedFolder) continue;

    // Match exact folder or any path within it
    if (normalized === normalizedFolder || normalized.startsWith(normalizedFolder + '/')) {
      return folder;
    }
  }

  return null;
}

/**
 * Check if a file has an excluded tag.
 */
function hasExcludedTag(app: App, filePath: string, excludedTags: string[]): string | null {
  if (excludedTags.length === 0) return null;

  // Only check markdown files
  if (!filePath.endsWith('.md')) return null;

  // Get file from vault
  const tfile = app.vault.getFileByPath(filePath);
  if (!tfile) return null;

  const cache = app.metadataCache.getFileCache(tfile);
  if (!cache) return null;

  const fileTags: string[] = [];

  // Frontmatter tags
  if (cache.frontmatter?.tags) {
    const fmTags = cache.frontmatter.tags;
    if (Array.isArray(fmTags)) {
      fileTags.push(...fmTags.map((t: string) => String(t).replace(/^#/, '').toLowerCase()));
    } else if (typeof fmTags === 'string') {
      fileTags.push(fmTags.replace(/^#/, '').toLowerCase());
    }
  }

  // Inline tags from cache
  if (cache.tags) {
    fileTags.push(...cache.tags.map((t) => t.tag.replace(/^#/, '').toLowerCase()));
  }

  // Check against excluded tags
  for (const excludedTag of excludedTags) {
    const normalizedExcluded = excludedTag.replace(/^#/, '').toLowerCase();
    if (fileTags.includes(normalizedExcluded)) {
      return excludedTag;
    }
    // Also check for nested tags (e.g., #parent matches #parent/child)
    if (fileTags.some((t) => t.startsWith(normalizedExcluded + '/'))) {
      return excludedTag;
    }
  }

  return null;
}

/**
 * Check a file against content restrictions.
 * Returns an error message if blocked, or null if allowed.
 */
function checkContentRestriction(
  filePath: string,
  context: ContentRestrictionContext,
): string | null {
  const excludedFolders = context.getExcludedFolders();
  const excludedTags = context.getExcludedTags();

  // Convert to vault-relative path if absolute
  const relativePath = filePath.startsWith(context.vaultPath)
    ? toVaultRelativePath(filePath, context.vaultPath)
    : normalizePath(filePath);

  // Check excluded folders
  const matchedFolder = isInExcludedFolder(relativePath, excludedFolders);
  if (matchedFolder) {
    return `Access denied: Path "${relativePath}" is in excluded folder "${matchedFolder}". This folder is blocked from access.`;
  }

  // Check excluded tags (only for markdown files)
  if (relativePath.endsWith('.md')) {
    const matchedTag = hasExcludedTag(context.app, relativePath, excludedTags);
    if (matchedTag) {
      return `Access denied: File "${relativePath}" has excluded tag "${matchedTag}". Files with this tag are blocked from access.`;
    }
  }

  return null;
}

/**
 * Create a PreToolUse hook to enforce content restrictions (excluded folders and tags).
 */
export function createContentRestrictionHook(
  context: ContentRestrictionContext,
): HookCallbackMatcher {
  return {
    hooks: [
      async (hookInput) => {
        const input = hookInput as {
          tool_name: string;
          tool_input: Record<string, unknown>;
        };

        const toolName = input.tool_name;

        // Only check file-related tools
        if (!isFileTool(toolName)) {
          return { continue: true };
        }

        // Get the path from tool input
        const filePath = getPathFromToolInput(toolName, input.tool_input);
        if (!filePath) {
          return { continue: true };
        }

        // Check content restrictions
        const error = checkContentRestriction(filePath, context);
        if (error) {
          return {
            continue: false,
            hookSpecificOutput: {
              hookEventName: 'PreToolUse' as const,
              permissionDecision: 'deny' as const,
              permissionDecisionReason: error,
            },
          };
        }

        return { continue: true };
      },
    ],
  };
}

/**
 * Check if a file path should be excluded from UI (for @-mention filtering).
 * This is a synchronous check for UI purposes.
 */
export function isPathExcluded(
  filePath: string,
  excludedFolders: string[],
  excludedTags: string[],
  app: App,
): boolean {
  const normalized = normalizePath(filePath);

  // Check excluded folders
  if (isInExcludedFolder(normalized, excludedFolders)) {
    return true;
  }

  // Check excluded tags for markdown files
  if (normalized.endsWith('.md') && hasExcludedTag(app, normalized, excludedTags)) {
    return true;
  }

  return false;
}
