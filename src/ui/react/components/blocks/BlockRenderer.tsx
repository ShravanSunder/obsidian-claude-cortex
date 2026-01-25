/**
 * Block renderer component
 *
 * Routes blocks to the appropriate type-specific renderer
 * (prose, code, mermaid).
 */

import type { Block } from '../../parser';
import { CodeBlock } from './CodeBlock';
import { MermaidBlock } from './MermaidBlock';
import { ProseBlock } from './ProseBlock';

export interface BlockRendererProps {
  /** Block to render */
  block: Block;
  /** Source path for link resolution in prose */
  sourcePath?: string;
  /** Optional class name */
  className?: string;
}

/**
 * Routes a block to its appropriate renderer
 */
export const BlockRenderer = ({ block, sourcePath, className }: BlockRendererProps) => {
  const isStreaming = block.state === 'streaming';

  switch (block.type) {
    case 'prose':
      return (
        <ProseBlock
          content={block.content}
          isStreaming={isStreaming}
          sourcePath={sourcePath}
          className={className}
        />
      );

    case 'code':
      return (
        <CodeBlock
          content={block.content}
          language={block.language}
          isStreaming={isStreaming}
          className={className}
        />
      );

    case 'mermaid':
      return (
        <MermaidBlock content={block.content} isStreaming={isStreaming} className={className} />
      );

    default: {
      // Type guard for exhaustiveness
      const _exhaustive: never = block.type;
      console.warn('[BlockRenderer] Unknown block type:', _exhaustive);
      return <div className="cortex-block-unknown">Unknown block type: {block.type}</div>;
    }
  }
};
