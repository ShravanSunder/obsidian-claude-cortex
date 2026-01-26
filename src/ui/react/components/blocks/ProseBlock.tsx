/**
 * Prose block component for markdown text
 *
 * Renders markdown prose using Obsidian's MarkdownRenderer for
 * full compatibility with Obsidian's features (links, callouts, etc.)
 */

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../hooks/useApp';

export interface ProseBlockProps {
  /** Markdown content to render */
  content: string;
  /** Whether the block is still streaming */
  isStreaming?: boolean;
  /** Source path for link resolution */
  sourcePath?: string;
  /** Optional class name */
  className?: string;
}

/**
 * Renders markdown prose using Obsidian's MarkdownRenderer
 *
 * During streaming, shows raw text with a cursor indicator.
 * When complete, renders via Obsidian's renderer.
 */
export const ProseBlock = ({
  content,
  isStreaming = false,
  sourcePath = '',
  className,
}: ProseBlockProps) => {
  const ctx = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<{ unload: () => void } | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  // Render with Obsidian when streaming completes
  useEffect(() => {
    if (isStreaming || !content || !containerRef.current || !ctx) {
      return;
    }

    const { app, Component, MarkdownRenderer } = ctx;

    const renderAsync = async () => {
      if (!containerRef.current) return;

      // Clean up previous render
      if (componentRef.current) {
        componentRef.current.unload();
        componentRef.current = null;
      }

      // Clear container
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }

      try {
        // Use Component and MarkdownRenderer from context (avoids dynamic import)
        const component = new Component();
        component.load();
        componentRef.current = component;

        await MarkdownRenderer.render(app, content, containerRef.current, sourcePath, component);
        setIsRendered(true);
      } catch (error) {
        console.error('[ProseBlock] Render failed:', error);
        // Fallback to plain text
        if (containerRef.current) {
          containerRef.current.textContent = content;
        }
      }
    };

    void renderAsync();

    return () => {
      componentRef.current?.unload();
      componentRef.current = null;
    };
  }, [ctx, content, isStreaming, sourcePath]);

  // Reset rendered state when content changes
  useEffect(() => {
    if (isStreaming) {
      setIsRendered(false);
    }
  }, [isStreaming]);

  const classNames = [
    'cortex-prose-block',
    isStreaming && 'cortex-prose-streaming',
    isRendered && 'cortex-prose-rendered',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      {isStreaming && (
        <>
          <span className="cortex-prose-text">{content}</span>
          <span className="cortex-streaming-cursor" />
        </>
      )}
      <div
        ref={containerRef}
        className="cortex-prose-content"
        style={{ display: isStreaming ? 'none' : 'block' }}
      />
    </div>
  );
};
