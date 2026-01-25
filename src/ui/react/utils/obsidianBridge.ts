/**
 * Obsidian Bridge Utilities
 *
 * Provides helper functions for integrating React components
 * with Obsidian's APIs and the existing Cortex system.
 */

import type { App } from 'obsidian';

/**
 * Get vault name from Obsidian App
 */
export function getVaultName(app: App | undefined): string {
  if (!app) return '';
  return app.vault.getName();
}

/**
 * Get vault base path from Obsidian App
 */
export function getVaultPath(app: App | undefined): string {
  if (!app) return '';
  return (app.vault.adapter as { basePath?: string }).basePath ?? '';
}

/**
 * Get active file path from Obsidian App
 */
export function getActiveFilePath(app: App | undefined): string {
  if (!app) return '';
  return app.workspace.getActiveFile()?.path ?? '';
}

/**
 * Open a file in Obsidian
 */
export async function openFile(app: App | undefined, path: string): Promise<void> {
  if (!app) return;
  const file = app.vault.getAbstractFileByPath(path);
  if (file) {
    await app.workspace.openLinkText(path, '', false);
  }
}

/**
 * Get all markdown files in vault
 */
export function getMarkdownFiles(app: App | undefined): string[] {
  if (!app) return [];
  return app.vault.getMarkdownFiles().map((f) => f.path);
}

/**
 * Get all folders in vault
 */
export function getFolders(app: App | undefined): string[] {
  if (!app) return [];
  const folders: string[] = [];
  app.vault.getAllLoadedFiles().forEach((f) => {
    if ('children' in f) {
      folders.push(f.path);
    }
  });
  return folders;
}

/**
 * Read file content from vault
 */
export async function readFile(app: App | undefined, path: string): Promise<string | null> {
  if (!app) return null;
  const file = app.vault.getAbstractFileByPath(path);
  if (file && 'extension' in file) {
    return app.vault.cachedRead(file as Parameters<App['vault']['cachedRead']>[0]);
  }
  return null;
}

/**
 * Check if app is available (for conditional rendering)
 */
export function isAppAvailable(app: App | undefined): app is App {
  return app !== undefined;
}

/**
 * Convert a stream chunk to parser-compatible format
 * This bridges the existing SDK stream format to the parser
 */
export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'error';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
}

/**
 * Extract text content from SDK stream events
 * This is a simplified bridge - full integration will depend on SDK types
 */
export function extractTextFromChunk(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== 'object') return null;

  // Handle ContentBlockDelta with text
  if ('delta' in chunk) {
    const delta = (chunk as { delta?: { text?: string } }).delta;
    if (delta?.text) return delta.text;
  }

  // Handle direct text content
  if ('text' in chunk && typeof (chunk as { text?: string }).text === 'string') {
    return (chunk as { text: string }).text;
  }

  return null;
}
