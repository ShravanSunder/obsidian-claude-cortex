/**
 * Semantic Search Service
 *
 * Provides true semantic/similarity search over vault content via Codanna MCP.
 * Requires Codanna to be installed and configured as an MCP server.
 *
 * @see https://github.com/bartolli/codanna
 */

/** Search result from semantic search. */
export interface SemanticSearchResult {
  /** Path to the matched file. */
  filePath: string;
  /** Title or name of the note. */
  title: string;
  /** Similarity score (0-1). */
  score: number;
  /** Excerpt showing the relevant content. */
  excerpt?: string;
}

/** Options for semantic search. */
export interface SearchOptions {
  /** Maximum number of results to return. */
  limit?: number;
  /** Minimum similarity score threshold (0-1). */
  minScore?: number;
  /** Folders to search within. */
  folders?: string[];
  /** Folders to exclude from search. */
  excludeFolders?: string[];
  /** File types to include (extensions). */
  fileTypes?: string[];
}

/**
 * Raw search result from MCP semantic search tool.
 * Different MCP servers may return results in different formats.
 */
interface McpSearchResultRaw {
  /** File path (Codanna uses 'file'). */
  file?: string;
  /** Alternative file path field. */
  filePath?: string;
  /** Alternative file path field. */
  path?: string;
  /** Note title. */
  title?: string;
  /** Alternative title field. */
  name?: string;
  /** Similarity score. */
  score?: number;
  /** Alternative score field. */
  similarity?: number;
  /** Excerpt of matching content. */
  excerpt?: string;
  /** Alternative excerpt field. */
  content?: string;
  /** Alternative excerpt field. */
  text?: string;
}

/**
 * Type guard to check if result is an array of MCP search results.
 * @param result - Unknown value to check.
 * @returns True if result is an array.
 */
function isMcpSearchResultArray(result: unknown): result is McpSearchResultRaw[] {
  return Array.isArray(result);
}

/**
 * Transform raw MCP result to normalized SemanticSearchResult.
 * @param raw - Raw result from MCP tool.
 * @returns Normalized search result.
 */
function normalizeSearchResult(raw: McpSearchResultRaw): SemanticSearchResult {
  return {
    filePath: raw.file ?? raw.filePath ?? raw.path ?? '',
    title: raw.title ?? raw.name ?? '',
    score: raw.score ?? raw.similarity ?? 0,
    excerpt: raw.excerpt ?? raw.content ?? raw.text ?? '',
  };
}

/** Codanna MCP server configuration. */
export const CODANNA_CONFIG = {
  /** MCP server name. */
  serverName: 'codanna',
  /** Primary search tool name. */
  searchTool: 'search',
  /** Alternative search tool names. */
  alternativeTools: ['semantic_search', 'query'],
  /** Installation command. */
  installCommand: 'cargo install codanna --all-features',
  /** GitHub repository URL. */
  githubUrl: 'https://github.com/bartolli/codanna',
  /** Rust installation URL. */
  rustUrl: 'https://rustup.rs',
} as const;

/** Type for MCP tool invoker function. */
export type McpToolInvoker = (
  server: string,
  tool: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Semantic Search Service using Codanna MCP.
 *
 * Codanna provides true semantic search using AI embeddings to find notes
 * by meaning, not just keyword matching.
 *
 * @example
 * ```typescript
 * const service = new SemanticSearchService();
 * service.setMcpInvoker(myInvoker);
 *
 * if (await service.isAvailable()) {
 *   const results = await service.search('notes about productivity');
 * }
 * ```
 */
export class SemanticSearchService {
  private mcpInvoker: McpToolInvoker | null = null;
  private availabilityCache: boolean | null = null;
  private detectedTool: string | null = null;

  /**
   * Set the MCP tool invoker for communicating with Codanna.
   * @param invoker - Function to invoke MCP tools.
   */
  setMcpInvoker(invoker: McpToolInvoker): void {
    this.mcpInvoker = invoker;
    this.availabilityCache = null; // Reset cache when invoker changes
    this.detectedTool = null;
  }

  /**
   * Check if Codanna MCP is available and responding.
   * Caches the result for subsequent calls.
   * @returns True if Codanna is available via MCP.
   */
  async isAvailable(): Promise<boolean> {
    if (this.availabilityCache !== null) {
      return this.availabilityCache;
    }

    if (!this.mcpInvoker) {
      this.availabilityCache = false;
      return false;
    }

    // Try each possible tool name
    const toolsToTry = [CODANNA_CONFIG.searchTool, ...CODANNA_CONFIG.alternativeTools];

    for (const tool of toolsToTry) {
      try {
        await this.mcpInvoker(CODANNA_CONFIG.serverName, tool, {
          query: '',
          limit: 1,
        });
        this.availabilityCache = true;
        this.detectedTool = tool;
        return true;
      } catch {
        // Tool not available, try next
      }
    }

    this.availabilityCache = false;
    return false;
  }

  /**
   * Reset the availability cache to force a fresh check.
   */
  resetCache(): void {
    this.availabilityCache = null;
    this.detectedTool = null;
  }

  /**
   * Perform semantic search using Codanna.
   * @param query - Natural language search query.
   * @param options - Search options.
   * @returns Array of matching results, or empty array if unavailable.
   * @throws Error if Codanna is not available.
   */
  async search(query: string, options?: SearchOptions): Promise<SemanticSearchResult[]> {
    if (!this.mcpInvoker) {
      throw new Error('MCP invoker not configured. Call setMcpInvoker first.');
    }

    // Ensure availability check has been done
    if (this.availabilityCache === null) {
      await this.isAvailable();
    }

    if (!this.availabilityCache || !this.detectedTool) {
      throw new Error(
        'Codanna is not available. Install it with: ' + CODANNA_CONFIG.installCommand,
      );
    }

    try {
      const result = await this.mcpInvoker(CODANNA_CONFIG.serverName, this.detectedTool, {
        query,
        limit: options?.limit ?? 20,
        min_score: options?.minScore ?? 0.5,
        folders: options?.folders,
        exclude_folders: options?.excludeFolders,
      });

      if (!isMcpSearchResultArray(result)) {
        return [];
      }

      return result.map(normalizeSearchResult).filter((r) => r.filePath !== '');
    } catch (error) {
      console.error('[SemanticSearchService] Search failed:', error);
      return [];
    }
  }

  /**
   * Get the detected search tool name.
   * @returns Tool name if available, null otherwise.
   */
  getDetectedTool(): string | null {
    return this.detectedTool;
  }
}
