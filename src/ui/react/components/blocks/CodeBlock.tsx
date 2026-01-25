/**
 * Code block component with syntax highlighting
 *
 * Renders code with syntax highlighting. Uses Obsidian's
 * highlighting when available, falls back to basic styling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../hooks/useApp';

export interface CodeBlockProps {
  /** Code content */
  content: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** Whether the block is still streaming */
  isStreaming?: boolean;
  /** Optional class name */
  className?: string;
}

/**
 * Renders a code block with syntax highlighting
 */
export const CodeBlock = ({
  content,
  language,
  isStreaming = false,
  className,
}: CodeBlockProps) => {
  const app = useApp();
  const codeRef = useRef<HTMLElement>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Apply syntax highlighting when streaming completes
  useEffect(() => {
    if (isStreaming || !content || !codeRef.current) {
      setIsHighlighted(false);
      return;
    }

    const highlight = async () => {
      if (!codeRef.current) return;

      try {
        // Try to use Obsidian's highlighting if available
        if (app && language) {
          // Obsidian uses Prism internally
          const { MarkdownRenderer, Component } = await import('obsidian');
          const container = document.createElement('div');
          const component = new Component();
          component.load();

          // Create a code block markdown to render
          const markdown = `\`\`\`${language}\n${content}\n\`\`\``;
          await MarkdownRenderer.render(app, markdown, container, '', component);

          // Extract the highlighted code
          const highlightedCode = container.querySelector('code');
          if (highlightedCode && codeRef.current) {
            codeRef.current.innerHTML = highlightedCode.innerHTML;
            codeRef.current.className = highlightedCode.className;
          }

          component.unload();
        }
        setIsHighlighted(true);
      } catch (error) {
        console.error('[CodeBlock] Highlighting failed:', error);
        setIsHighlighted(true); // Still mark as complete
      }
    };

    void highlight();
  }, [app, content, language, isStreaming]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(content);
  }, [content]);

  const classNames = [
    'cortex-code-block',
    isStreaming && 'cortex-code-streaming',
    isHighlighted && 'cortex-code-highlighted',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      <div className="cortex-code-header">
        {language && <span className="cortex-code-language">{language}</span>}
        <button
          type="button"
          className="cortex-code-copy"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          Copy
        </button>
      </div>
      <pre className="cortex-code-pre">
        <code ref={codeRef} className={language ? `language-${language}` : ''}>
          {content}
        </code>
        {isStreaming && <span className="cortex-streaming-cursor" />}
      </pre>
    </div>
  );
};
