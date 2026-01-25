/**
 * Mermaid diagram block component
 *
 * Renders mermaid diagrams with proper loading states to prevent
 * flashing during streaming. Shows skeleton while loading, then
 * the rendered diagram.
 *
 * Includes height reservation and IntersectionObserver for viewport
 * preservation - prevents layout shifts when diagrams render.
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

type RenderState = 'streaming' | 'pending' | 'loading' | 'rendered' | 'error';

/** Minimum height to reserve for loading state to prevent layout shift */
const MIN_SKELETON_HEIGHT = 200;

/**
 * Renders a mermaid diagram with loading states and viewport preservation
 *
 * State flow:
 * - streaming: Show raw code
 * - pending: Waiting for visibility (IntersectionObserver)
 * - loading: Show skeleton while mermaid renders
 * - rendered: Show SVG
 * - error: Show error message with raw code
 *
 * Height reservation prevents layout shifts when diagrams render:
 * - During loading: reserves MIN_SKELETON_HEIGHT
 * - After render: captures actual height for future stability
 */
export const MermaidBlock = ({ content, isStreaming = false, className }: MermaidBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RenderState>(isStreaming ? 'streaming' : 'pending');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(MIN_SKELETON_HEIGHT);

  // Reset state when streaming starts
  useEffect(() => {
    if (isStreaming) {
      setState('streaming');
      setSvg('');
      setError('');
      setIsVisible(false);
    }
  }, [isStreaming]);

  // IntersectionObserver for deferred rendering - only render when visible
  useEffect(() => {
    if (isStreaming) return;

    const container = containerRef.current;
    if (!container) return;

    // If already rendered, no need to observe
    if (state === 'rendered') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px', // Pre-render 200px before visible
        threshold: 0,
      },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [isStreaming, state]);

  // Transition from pending to loading when visible
  useEffect(() => {
    if (state === 'pending' && isVisible && !isStreaming) {
      setState('loading');
    }
  }, [state, isVisible, isStreaming]);

  // Render mermaid when in loading state
  useEffect(() => {
    if (state !== 'loading' || !content) {
      return;
    }

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
  }, [content, state]);

  // Capture rendered height to prevent future layout shifts
  useEffect(() => {
    if (state === 'rendered' && svgContainerRef.current) {
      // Wait for next frame to ensure SVG is laid out
      requestAnimationFrame(() => {
        const height = svgContainerRef.current?.getBoundingClientRect().height;
        if (height && height > measuredHeight) {
          setMeasuredHeight(height);
        }
      });
    }
  }, [state, measuredHeight]);

  const classNames = ['cortex-mermaid-block', `cortex-mermaid-${state}`, className]
    .filter(Boolean)
    .join(' ');

  // Calculate min-height for non-rendered states to prevent layout shift
  const containerStyle = state !== 'rendered' ? { minHeight: `${measuredHeight}px` } : undefined;

  return (
    <div ref={containerRef} className={classNames} style={containerStyle}>
      <div className="cortex-mermaid-header">
        <span className="cortex-mermaid-label">mermaid</span>
        {(state === 'loading' || state === 'pending') && (
          <span className="cortex-mermaid-status">
            {state === 'pending' ? 'Waiting...' : 'Rendering...'}
          </span>
        )}
      </div>

      {state === 'streaming' && (
        <pre className="cortex-mermaid-code">
          <code>{content}</code>
          <span className="cortex-streaming-cursor" />
        </pre>
      )}

      {(state === 'pending' || state === 'loading') && (
        <BlockSkeleton
          type="mermaid"
          label={state === 'pending' ? 'Waiting to render...' : 'Rendering diagram...'}
        />
      )}

      {state === 'rendered' && (
        <div
          ref={svgContainerRef}
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
