/**
 * Mermaid diagram block component
 *
 * Renders mermaid diagrams with proper loading states to prevent
 * flashing during streaming. Shows skeleton while loading, then
 * the rendered diagram.
 *
 * Includes height reservation and IntersectionObserver for viewport
 * preservation - prevents layout shifts when diagrams render.
 *
 * Handles unsupported diagram types with clear UI feedback and
 * optionally auto-fixes broken diagrams via Claude.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getUnsupportedType,
  type UnsupportedMermaidType,
} from '../../../../features/chat/services/MermaidFixService';
import { djb2Hash } from '../../parser';
import { BlockSkeleton } from './BlockSkeleton';

export interface MermaidBlockProps {
  /** Mermaid diagram code */
  content: string;
  /** Whether the block is still streaming */
  isStreaming?: boolean;
  /** Optional class name */
  className?: string;
  /** Callback when content is fixed (optional - enables auto-fix) */
  onContentFixed?: (fixedContent: string) => void;
  /** Service for fixing mermaid diagrams (optional - enables auto-fix) */
  fixService?: {
    fixMermaid: (
      brokenCode: string,
      renderError: Error,
      diagramId: string,
      callback: (
        diagramId: string,
        result: { success: boolean; fixedCode?: string; error?: string },
      ) => void,
    ) => Promise<void>;
    cancelFix: (diagramId: string) => void;
  };
}

type RenderState =
  | 'streaming'
  | 'pending'
  | 'loading'
  | 'rendered'
  | 'error'
  | 'unsupported'
  | 'fixing';

/** Minimum height to reserve for loading state to prevent layout shift */
const MIN_SKELETON_HEIGHT = 200;

/** Maximum auto-fix attempts per diagram render */
const MAX_FIX_ATTEMPTS = 1;

/**
 * Renders a mermaid diagram with loading states and viewport preservation
 *
 * State flow:
 * - streaming: Show raw code
 * - pending: Waiting for visibility (IntersectionObserver)
 * - loading: Show skeleton while mermaid renders
 * - rendered: Show SVG
 * - error: Show error message with raw code
 * - unsupported: Show "not supported" message with raw code
 * - fixing: Show skeleton while auto-fix is in progress
 *
 * Height reservation prevents layout shifts when diagrams render:
 * - During loading: reserves MIN_SKELETON_HEIGHT
 * - After render: captures actual height for future stability
 */
export const MermaidBlock = ({
  content,
  isStreaming = false,
  className,
  onContentFixed,
  fixService,
}: MermaidBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RenderState>(isStreaming ? 'streaming' : 'pending');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [unsupportedType, setUnsupportedType] = useState<UnsupportedMermaidType | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(MIN_SKELETON_HEIGHT);
  const [fixAttempts, setFixAttempts] = useState(0);

  // Generate stable diagram ID for fix tracking
  const diagramId = `mermaid-${djb2Hash(content)}`;

  // Check for unsupported types before any rendering
  useEffect(() => {
    const unsupported = getUnsupportedType(content);
    if (unsupported) {
      setUnsupportedType(unsupported);
      setState('unsupported');
      setError(`${unsupported} diagrams are not supported in Obsidian`);
    } else {
      setUnsupportedType(null);
      // Don't reset state if already in a valid state
      if (state === 'unsupported') {
        setState('pending');
      }
    }
  }, [content, state]);

  // Handle streaming state transitions
  useEffect(() => {
    if (isStreaming) {
      // Entering streaming mode - reset everything
      setState('streaming');
      setSvg('');
      setError('');
      setUnsupportedType(null);
      setIsVisible(false);
      setFixAttempts(0);
    } else {
      // Exiting streaming mode - check for unsupported type first, then transition
      const unsupported = getUnsupportedType(content);
      if (unsupported) {
        setUnsupportedType(unsupported);
        setState('unsupported');
        setError(`${unsupported} diagrams are not supported in Obsidian`);
      } else {
        setState((prev) => (prev === 'streaming' ? 'pending' : prev));
      }
    }
  }, [isStreaming, content]);

  // IntersectionObserver for deferred rendering - only render when visible
  useEffect(() => {
    if (isStreaming || state === 'unsupported') return;

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

  // Handle fix callback
  const handleFixResult = useCallback(
    (resultDiagramId: string, result: { success: boolean; fixedCode?: string; error?: string }) => {
      if (resultDiagramId !== diagramId) return;

      if (result.success && result.fixedCode && onContentFixed) {
        onContentFixed(result.fixedCode);
        // Parent will update content, which will trigger re-render
      } else {
        // Fix failed - show original error
        setState('error');
      }
    },
    [diagramId, onContentFixed],
  );

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
        setFixAttempts(0); // Reset on successful render
      } catch (err) {
        const renderError = err instanceof Error ? err : new Error('Failed to render');
        console.error('[MermaidBlock] Render failed:', renderError.message);

        // Check if we should attempt auto-fix
        const canAutoFix =
          fixService &&
          onContentFixed &&
          fixAttempts < MAX_FIX_ATTEMPTS &&
          !getUnsupportedType(content); // Don't try to fix unsupported types

        if (canAutoFix) {
          // Attempt auto-fix
          setState('fixing');
          setFixAttempts((prev) => prev + 1);
          void fixService.fixMermaid(content, renderError, diagramId, handleFixResult);
        } else {
          setError(renderError.message);
          setState('error');
        }
      }
    };

    void renderMermaid();
  }, [content, state, fixAttempts, fixService, onContentFixed, diagramId, handleFixResult]);

  // Cleanup fix attempts on unmount
  useEffect(() => {
    return () => {
      if (fixService && state === 'fixing') {
        fixService.cancelFix(diagramId);
      }
    };
  }, [fixService, diagramId, state]);

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

  // Render unsupported state
  if (state === 'unsupported') {
    return (
      <div ref={containerRef} className={classNames} style={containerStyle}>
        <div className="cortex-mermaid-header">
          <span className="cortex-mermaid-label">mermaid</span>
          <span className="cortex-mermaid-unsupported-badge">Not Supported</span>
        </div>
        <div className="cortex-mermaid-unsupported-message">
          <span className="cortex-mermaid-unsupported-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          {unsupportedType && (
            <span>
              <strong>{unsupportedType}</strong> diagrams are not supported in Obsidian&apos;s
              Mermaid version
            </span>
          )}
        </div>
        <pre className="cortex-mermaid-code">
          <code>{content}</code>
        </pre>
      </div>
    );
  }

  // Render fixing state
  if (state === 'fixing') {
    return (
      <div ref={containerRef} className={classNames} style={containerStyle}>
        <div className="cortex-mermaid-header">
          <span className="cortex-mermaid-label">mermaid</span>
          <span className="cortex-mermaid-status cortex-mermaid-fixing-status">Auto-fixing...</span>
        </div>
        <BlockSkeleton type="mermaid" label="Fixing diagram..." />
      </div>
    );
  }

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
