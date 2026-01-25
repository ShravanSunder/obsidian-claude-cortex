/**
 * Streaming Markdown Parser
 *
 * Incrementally parses markdown text as it streams in, detecting
 * block boundaries (code fences, prose) and emitting events for
 * stable React rendering.
 *
 * Key features:
 * - Detects ``` code fence start/end
 * - Extracts language hints from fences
 * - Handles incomplete fences during streaming
 * - Emits block_start, block_delta, block_complete events
 * - Content-hash based block IDs for stable React keys
 */

import { generateBlockId } from './hash';
import type { Block, BlockEvent, BlockType, ParserOptions, ParserState } from './types';

/**
 * Code fence regex patterns
 */
const CODE_FENCE_START = /^```(\w*)\s*$/;
const CODE_FENCE_END = /^```\s*$/;

export class StreamingMarkdownParser {
  private state: ParserState = 'idle';
  private blocks: Block[] = [];
  private currentBlock: Block | null = null;
  private buffer: string = '';
  private blockIndex: number = 0;
  private options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.options = {
      detectMermaid: true,
      ...options,
    };
  }

  /**
   * Push new content into the parser
   *
   * @param chunk - New text chunk to process
   * @returns Array of events emitted during processing
   */
  push(chunk: string): BlockEvent[] {
    const events: BlockEvent[] = [];
    this.buffer += chunk;

    // Process buffer line by line, keeping incomplete lines
    while (true) {
      const newlineIndex = this.buffer.indexOf('\n');

      if (newlineIndex === -1) {
        // No complete line, but we may have content to process
        // for character-level streaming in prose
        if (this.state === 'in_prose' && this.buffer.length > 0) {
          events.push(...this.processProseContent(this.buffer, false));
          this.buffer = '';
        }
        break;
      }

      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      events.push(...this.processLine(line));
    }

    return events;
  }

  /**
   * Signal end of stream, completing any open blocks
   *
   * @returns Array of completion events
   */
  end(): BlockEvent[] {
    const events: BlockEvent[] = [];

    // Process any remaining buffer
    if (this.buffer.length > 0) {
      events.push(...this.processLine(this.buffer));
      this.buffer = '';
    }

    // Complete any open block
    if (this.currentBlock) {
      this.currentBlock.state = 'complete';
      events.push({
        type: 'block_complete',
        blockId: this.currentBlock.id,
      });
      this.blocks.push(this.currentBlock);
      this.currentBlock = null;
    }

    this.state = 'idle';
    return events;
  }

  /**
   * Reset parser state for reuse
   */
  reset(): void {
    this.state = 'idle';
    this.blocks = [];
    this.currentBlock = null;
    this.buffer = '';
    this.blockIndex = 0;
  }

  /**
   * Get all completed blocks
   */
  getBlocks(): Block[] {
    return [...this.blocks];
  }

  /**
   * Get current block being streamed (if any)
   */
  getCurrentBlock(): Block | null {
    return this.currentBlock;
  }

  /**
   * Get all blocks including current streaming block
   */
  getAllBlocks(): Block[] {
    const all = [...this.blocks];
    if (this.currentBlock) {
      all.push(this.currentBlock);
    }
    return all;
  }

  private processLine(line: string): BlockEvent[] {
    const events: BlockEvent[] = [];

    switch (this.state) {
      case 'idle':
      case 'in_prose':
        events.push(...this.processProseOrFenceStart(line));
        break;
      case 'in_code_fence':
        events.push(...this.processCodeContent(line));
        break;
    }

    return events;
  }

  private processProseOrFenceStart(line: string): BlockEvent[] {
    const events: BlockEvent[] = [];

    // Check for code fence start
    const fenceMatch = line.match(CODE_FENCE_START);
    if (fenceMatch) {
      // Complete current prose block if any
      if (this.currentBlock && this.currentBlock.type === 'prose') {
        this.currentBlock.state = 'complete';
        events.push({
          type: 'block_complete',
          blockId: this.currentBlock.id,
        });
        this.blocks.push(this.currentBlock);
        this.currentBlock = null;
      }

      // Start new code block
      const language = fenceMatch[1] || '';
      const blockType: BlockType = this.isMermaid(language) ? 'mermaid' : 'code';

      this.currentBlock = {
        id: generateBlockId('', this.blockIndex, blockType),
        type: blockType,
        content: '',
        language: language || undefined,
        state: 'streaming',
        index: this.blockIndex++,
      };

      events.push({
        type: 'block_start',
        block: { ...this.currentBlock },
      });

      this.state = 'in_code_fence';
      return events;
    }

    // Regular prose content
    events.push(...this.processProseContent(line + '\n', true));
    return events;
  }

  private processProseContent(content: string, isCompleteLine: boolean): BlockEvent[] {
    const events: BlockEvent[] = [];

    // Skip empty content at start
    if (!this.currentBlock && content.trim() === '' && isCompleteLine) {
      return events;
    }

    // Start prose block if needed
    if (!this.currentBlock || this.currentBlock.type !== 'prose') {
      this.currentBlock = {
        id: generateBlockId(content, this.blockIndex, 'prose'),
        type: 'prose',
        content: '',
        state: 'streaming',
        index: this.blockIndex++,
      };

      events.push({
        type: 'block_start',
        block: { ...this.currentBlock },
      });

      this.state = 'in_prose';
    }

    // Add content to block
    this.currentBlock.content += content;

    events.push({
      type: 'block_delta',
      blockId: this.currentBlock.id,
      delta: content,
      content: this.currentBlock.content,
    });

    return events;
  }

  private processCodeContent(line: string): BlockEvent[] {
    const events: BlockEvent[] = [];

    // Check for code fence end
    if (CODE_FENCE_END.test(line)) {
      if (this.currentBlock) {
        this.currentBlock.state = 'complete';
        events.push({
          type: 'block_complete',
          blockId: this.currentBlock.id,
        });
        this.blocks.push(this.currentBlock);
        this.currentBlock = null;
      }

      this.state = 'idle';
      return events;
    }

    // Add content to code block
    if (this.currentBlock) {
      const content = this.currentBlock.content
        ? line + '\n'
        : line.endsWith('\n')
          ? line
          : line + '\n';
      this.currentBlock.content += content;

      events.push({
        type: 'block_delta',
        blockId: this.currentBlock.id,
        delta: content,
        content: this.currentBlock.content,
      });
    }

    return events;
  }

  private isMermaid(language: string): boolean {
    if (!this.options.detectMermaid) return false;
    return language.toLowerCase() === 'mermaid';
  }
}
