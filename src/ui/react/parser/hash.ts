/**
 * Content hashing utilities for stable block identity
 *
 * Uses djb2 algorithm for fast, stable hashing of content.
 * This ensures React keys remain stable during streaming.
 */

/**
 * djb2 hash algorithm
 * Fast string hashing with good distribution
 *
 * @param str - String to hash
 * @returns 32-bit hash as hex string
 */
export function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + char
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

/**
 * Generate a stable block ID from content and position
 *
 * @param content - Block content (or initial content for streaming)
 * @param index - Position index in message
 * @param type - Block type
 * @returns Stable identifier string
 */
export function generateBlockId(content: string, index: number, type: string): string {
  // Use first 50 chars of content for identity
  // This provides stability while streaming continues
  const contentPrefix = content.slice(0, 50);
  return `${type}-${index}-${djb2Hash(contentPrefix)}`;
}
