/**
 * Hook for rendering markdown using Obsidian's MarkdownRenderer
 *
 * Provides a way to use Obsidian's built-in markdown rendering
 * within React components, handling the Component lifecycle properly.
 */

import type { Component } from 'obsidian';
import { useCallback, useEffect, useRef } from 'react';
import { useApp } from './useApp';

/**
 * Result of the useObsidianRender hook
 */
export interface UseObsidianRenderResult {
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Manually trigger a render */
  render: (content: string, sourcePath?: string) => Promise<void>;
  /** Clear the rendered content */
  clear: () => void;
}

/**
 * Hook that provides Obsidian markdown rendering capabilities to React components
 *
 * @param sourcePath - Optional source path for link resolution
 * @returns Object with containerRef, render function, and clear function
 *
 * @example
 * ```tsx
 * const ProseBlock = ({ content }) => {
 *   const { containerRef, render } = useObsidianRender();
 *
 *   useEffect(() => {
 *     render(content);
 *   }, [content, render]);
 *
 *   return <div ref={containerRef} />;
 * };
 * ```
 */
export function useObsidianRender(sourcePath: string = ''): UseObsidianRenderResult {
  const ctx = useApp();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const componentRef = useRef<Component | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      componentRef.current?.unload();
      componentRef.current = null;
    };
  }, []);

  const clear = useCallback(() => {
    if (containerRef.current) {
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
    }
    componentRef.current?.unload();
    componentRef.current = null;
  }, []);

  const render = useCallback(
    async (content: string, customSourcePath?: string) => {
      if (!containerRef.current || !ctx) {
        return;
      }

      // Clean up previous render
      clear();

      // Use Component and MarkdownRenderer from context (avoids dynamic import)
      const { app, Component: ObsidianComponent, MarkdownRenderer } = ctx;
      componentRef.current = new ObsidianComponent();
      componentRef.current.load();

      // Render markdown
      await MarkdownRenderer.render(
        app,
        content,
        containerRef.current,
        customSourcePath ?? sourcePath,
        componentRef.current,
      );
    },
    [ctx, sourcePath, clear],
  );

  return {
    containerRef,
    render,
    clear,
  };
}
