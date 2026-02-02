/**
 * Cortex - Mermaid fix service
 *
 * Uses transient Claude sessions to fix broken Mermaid diagram syntax.
 * Follows the same pattern as TitleGenerationService - no session persistence,
 * automatic cleanup when the async iterator completes.
 */

import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { query as agentQuery } from '@anthropic-ai/claude-agent-sdk';

import type CortexPlugin from '../../../main';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';

/** Mermaid diagram types not supported by Obsidian's bundled Mermaid version */
export const UNSUPPORTED_MERMAID_TYPES = [
  'gantt',
  'timeline',
  'mindmap',
  'quadrantchart',
  'sankey',
  'xychart',
  'block',
] as const;

export type UnsupportedMermaidType = (typeof UNSUPPORTED_MERMAID_TYPES)[number];

/**
 * Detects if a mermaid diagram uses an unsupported type.
 * Returns the unsupported type name, or null if the type is supported.
 */
export function getUnsupportedType(content: string): UnsupportedMermaidType | null {
  const trimmed = content.trim();
  const firstLine = trimmed.split('\n')[0]?.toLowerCase() ?? '';

  for (const type of UNSUPPORTED_MERMAID_TYPES) {
    // Check for exact match or match with suffix (e.g., "sankey-beta", "xychart-beta")
    if (firstLine.startsWith(type)) {
      return type;
    }
  }
  return null;
}

/**
 * Extracts mermaid code from a Claude response.
 * Looks for code in mermaid blocks or generic code blocks.
 */
export function extractMermaidFromResponse(response: string): string {
  // Try to find ```mermaid block first (with optional content)
  const mermaidMatch = response.match(/```mermaid\n([\s\S]*?)```/);
  if (mermaidMatch) {
    return mermaidMatch[1].trim();
  }

  // Try generic code block (with optional content)
  const codeMatch = response.match(/```\n?([\s\S]*?)```/);
  if (codeMatch) {
    return codeMatch[1].trim();
  }

  return '';
}

const MERMAID_FIX_SYSTEM_PROMPT = `You fix broken Mermaid diagrams. Rules:
1. Output ONLY the fixed mermaid code in a code block
2. Keep the same diagram TYPE (flowchart, sequence, etc.)
3. Preserve the original intent and content
4. Fix syntax errors only - don't redesign
5. If unfixable, output the original unchanged`;

/** Result of mermaid fix attempt (discriminated union). */
export type MermaidFixResult =
  | { success: true; fixedCode: string }
  | { success: false; error: string };

/** Callback when mermaid fix completes. */
export type MermaidFixCallback = (diagramId: string, result: MermaidFixResult) => void;

/** Service for fixing broken Mermaid diagrams with AI. */
export class MermaidFixService {
  private plugin: CortexPlugin;
  /** Map of diagramId to AbortController for concurrent fix support. */
  private activeFixAttempts: Map<string, AbortController> = new Map();

  constructor(plugin: CortexPlugin) {
    this.plugin = plugin;
  }

  /**
   * Attempts to fix a broken mermaid diagram.
   * Non-blocking: calls callback when complete.
   *
   * @param brokenCode - The broken mermaid code
   * @param renderError - The error from mermaid rendering
   * @param diagramId - Unique ID for this diagram (for cancellation)
   * @param callback - Called with the result (fixed code or error)
   */
  async fixMermaid(
    brokenCode: string,
    renderError: Error,
    diagramId: string,
    callback: MermaidFixCallback,
  ): Promise<void> {
    const vaultPath = getVaultPath(this.plugin.app);
    if (!vaultPath) {
      console.warn('[MermaidFix] Could not determine vault path');
      this.safeCallback(callback, diagramId, {
        success: false,
        error: 'Could not determine vault path',
      });
      return;
    }

    const resolvedClaudePath = this.plugin.getResolvedClaudeCliPath();
    if (!resolvedClaudePath) {
      console.warn('[MermaidFix] Claude CLI not found');
      this.safeCallback(callback, diagramId, {
        success: false,
        error: 'Claude CLI not found',
      });
      return;
    }

    // Cancel any existing fix attempt for this diagram
    const existingController = this.activeFixAttempts.get(diagramId);
    if (existingController) {
      existingController.abort();
    }

    // Create new AbortController for this fix attempt
    const abortController = new AbortController();
    this.activeFixAttempts.set(diagramId, abortController);

    const envVars = parseEnvironmentVariables(this.plugin.getActiveEnvironmentVariables());

    // Use haiku for fast, cheap fixes
    const fixModel = envVars.ANTHROPIC_DEFAULT_HAIKU_MODEL || 'claude-haiku-4-5';

    const prompt = `Fix this Mermaid diagram.

**Render Error:** ${renderError.message}

\`\`\`mermaid
${brokenCode}
\`\`\``;

    const options: Options = {
      cwd: vaultPath,
      systemPrompt: MERMAID_FIX_SYSTEM_PROMPT,
      model: fixModel,
      abortController,
      pathToClaudeCodeExecutable: resolvedClaudePath,
      env: {
        ...process.env,
        ...envVars,
        PATH: getEnhancedPath(envVars.PATH, resolvedClaudePath),
      },
      allowedTools: [], // No tools needed for fix
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
    };

    try {
      const response = agentQuery({ prompt, options });
      let responseText = '';

      for await (const message of response) {
        if (abortController.signal.aborted) {
          this.safeCallback(callback, diagramId, {
            success: false,
            error: 'Cancelled',
          });
          return;
        }

        const text = this.extractTextFromMessage(message);
        if (text) {
          responseText += text;
        }
      }

      const fixedCode = extractMermaidFromResponse(responseText);

      if (fixedCode && fixedCode !== brokenCode) {
        // Validate the fix by parsing it
        const isValid = await this.validateMermaid(fixedCode);
        if (isValid) {
          this.safeCallback(callback, diagramId, { success: true, fixedCode });
        } else {
          // Fix didn't produce valid mermaid
          console.warn('[MermaidFix] Fix attempt produced invalid mermaid');
          this.safeCallback(callback, diagramId, {
            success: false,
            error: 'Fix attempt failed validation',
          });
        }
      } else if (!fixedCode) {
        console.warn('[MermaidFix] Could not extract code from response');
        this.safeCallback(callback, diagramId, {
          success: false,
          error: 'Could not extract fixed code from response',
        });
      } else {
        // fixedCode === brokenCode - no change
        console.warn('[MermaidFix] Fix returned same code as original');
        this.safeCallback(callback, diagramId, {
          success: false,
          error: 'Could not fix diagram',
        });
      }
    } catch (error) {
      // Don't log AbortError as it's expected when cancelled
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[MermaidFix] Error fixing mermaid:', error.message);
      }
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.safeCallback(callback, diagramId, { success: false, error: msg });
    } finally {
      this.activeFixAttempts.delete(diagramId);
    }
  }

  /**
   * Validates mermaid code by attempting to parse it.
   * Returns true if the code is valid mermaid syntax.
   */
  async validateMermaid(code: string): Promise<boolean> {
    try {
      const mermaid = await import('mermaid');
      mermaid.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
      });
      await mermaid.default.parse(code);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cancels any active fix attempt for a specific diagram.
   */
  cancelFix(diagramId: string): void {
    const controller = this.activeFixAttempts.get(diagramId);
    if (controller) {
      controller.abort();
      this.activeFixAttempts.delete(diagramId);
    }
  }

  /**
   * Cancels all active fix attempts.
   */
  cancelAll(): void {
    for (const controller of this.activeFixAttempts.values()) {
      controller.abort();
    }
    this.activeFixAttempts.clear();
  }

  /** Extracts text content from SDK message. */
  private extractTextFromMessage(message: {
    type: string;
    message?: { content?: Array<{ type: string; text?: string }> };
  }): string {
    if (message.type !== 'assistant' || !message.message?.content) {
      return '';
    }

    return message.message.content
      .filter(
        (block): block is { type: 'text'; text: string } => block.type === 'text' && !!block.text,
      )
      .map((block) => block.text)
      .join('');
  }

  /** Safely invokes callback with try-catch to prevent unhandled errors. */
  private safeCallback(
    callback: MermaidFixCallback,
    diagramId: string,
    result: MermaidFixResult,
  ): void {
    try {
      callback(diagramId, result);
    } catch (error) {
      console.error(
        '[MermaidFix] Error in callback:',
        error instanceof Error ? error.message : error,
      );
    }
  }
}
