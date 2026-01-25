/**
 * Types for the streaming markdown parser
 *
 * The parser processes streaming text and emits block events
 * for stable React rendering with content-hash based keys.
 */

/**
 * Supported block types in streaming markdown
 */
export type BlockType = 'prose' | 'code' | 'mermaid';

/**
 * Block state during streaming
 */
export type BlockState = 'streaming' | 'complete';

/**
 * A parsed block of content
 */
export interface Block {
  /** Unique identifier based on content hash and position */
  id: string;
  /** Type of block */
  type: BlockType;
  /** Raw content of the block */
  content: string;
  /** Language hint for code blocks */
  language?: string;
  /** Whether the block is complete or still streaming */
  state: BlockState;
  /** Position index in the message */
  index: number;
}

/**
 * Event types emitted by the parser
 */
export type BlockEventType = 'block_start' | 'block_delta' | 'block_complete';

/**
 * Event emitted when a new block starts
 */
export interface BlockStartEvent {
  type: 'block_start';
  block: Block;
}

/**
 * Event emitted when content is added to a block
 */
export interface BlockDeltaEvent {
  type: 'block_delta';
  blockId: string;
  delta: string;
  content: string;
}

/**
 * Event emitted when a block is complete
 */
export interface BlockCompleteEvent {
  type: 'block_complete';
  blockId: string;
}

/**
 * Union of all block events
 */
export type BlockEvent = BlockStartEvent | BlockDeltaEvent | BlockCompleteEvent;

/**
 * Internal parser state
 */
export type ParserState = 'idle' | 'in_prose' | 'in_code_fence';

/**
 * Parser configuration options
 */
export interface ParserOptions {
  /** Whether to treat mermaid code blocks specially */
  detectMermaid?: boolean;
}
