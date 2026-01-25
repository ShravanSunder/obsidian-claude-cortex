/**
 * Mermaid diagram block component
 *
 * Renders mermaid diagrams with proper loading states to prevent
 * flashing during streaming. Shows skeleton while loading, then
 * the rendered diagram.
 */

import { useEffect, useRef, useState } from 'react';
import { djb2Hash } from '../../parser';
import { BlockSkeleton } from './BlockSkeleton';

export interface MermaidBlockProps {
  /** Mermaid diagram code */
  content: string;
  /** Whether the block is still streaming */
  isStreaming?: boolean;
  /** Optional class name */
  className?: string;
}

type RenderState = 'streaming' | 'loading' | 'rendered' | 'error';

/**
 * Renders a mermaid diagram with loading states
 *
 * State flow:
 * - streaming: Show raw code
 * - loading: Show skeleton while mermaid renders
 * - rendered: Show SVG
 * - error: Show error message with raw code
 */
export const MermaidBlock = ({ content, isStreaming = false, className }: MermaidBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RenderState>(isStreaming ? 'streaming' : 'loading');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Reset state when streaming starts
  useEffect(() => {
    if (isStreaming) {
      setState('streaming');
      setSvg('');
      setError('');
    }
  }, [isStreaming]);

  // Render mermaid when streaming completes
  useEffect(() => {
    if (isStreaming || !content) {
      return;
    }

    setState('loading');

    const renderMermaid = async () => {
      try {
        // Dynamic import of mermaid
        const mermaid = await import('mermaid');

        // Generate unique ID based on content
        const id = `mermaid-${djb2Hash(content)}`;

        // Initialize mermaid with safe settings
        mermaid.default.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
        });

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.default.render(id, content);
        setSvg(renderedSvg);
        setState('rendered');
      } catch (err) {
        console.error('[MermaidBlock] Render failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to render');
        setState('error');
      }
    };

    void renderMermaid();
  }, [content, isStreaming]);

  const classNames = ['cortex-mermaid-block', `cortex-mermaid-${state}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      <div className="cortex-mermaid-header">
        <span className="cortex-mermaid-label">mermaid</span>
        {state === 'loading' && <span className="cortex-mermaid-status">Rendering...</span>}
      </div>

      {state === 'streaming' && (
        <pre className="cortex-mermaid-code">
          <code>{content}</code>
          <span className="cortex-streaming-cursor" />
        </pre>
      )}

      {state === 'loading' && <BlockSkeleton type="mermaid" label="Rendering diagram..." />}

      {state === 'rendered' && (
        <div
          ref={containerRef}
          className="cortex-mermaid-svg"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {state === 'error' && (
        <div className="cortex-mermaid-error">
          <div className="cortex-mermaid-error-message">{error}</div>
          <pre className="cortex-mermaid-code">
            <code>{content}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
