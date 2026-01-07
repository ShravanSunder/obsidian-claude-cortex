/**
 * Mermaid Diagram Renderer
 *
 * Renders and enhances mermaid code blocks in chat with:
 * - Actual diagram rendering (Obsidian doesn't render in sidebar/ItemView)
 * - Validation before rendering
 * - "Save as note" functionality
 * - Copy diagram source
 */

import mermaid from 'mermaid';
import type { App } from 'obsidian';
import { setIcon } from 'obsidian';

// Initialize mermaid with Obsidian-friendly config
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

/**
 * Validate mermaid diagram syntax.
 * @param code - The mermaid diagram code to validate.
 * @returns Error message if invalid, null if valid.
 */
export async function validateMermaid(code: string): Promise<string | null> {
  try {
    await mermaid.parse(code);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid mermaid syntax';
  }
}

/**
 * Render mermaid diagrams in a container.
 * Call this after MarkdownRenderer.renderMarkdown() since Obsidian
 * doesn't render mermaid in sidebar/ItemView.
 * @param containerEl - The container element to search for mermaid blocks.
 */
export async function renderMermaidBlocks(containerEl: HTMLElement): Promise<void> {
  const codeBlocks = Array.from(containerEl.querySelectorAll('pre > code.language-mermaid'));

  for (const codeEl of codeBlocks) {
    const preEl = codeEl.parentElement;
    if (!preEl) continue;

    const code = codeEl.textContent || '';
    if (!code.trim()) continue;

    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const { svg } = await mermaid.render(id, code);
      const wrapper = document.createElement('div');
      wrapper.className = 'cortex-mermaid-diagram';
      // Store original code for save/copy functionality
      wrapper.dataset.mermaidSource = code;
      wrapper.innerHTML = svg;
      preEl.replaceWith(wrapper);
    } catch (error) {
      // Keep original code block on error, add error indicator
      preEl.classList.add('cortex-mermaid-error');
      const errorMsg = error instanceof Error ? error.message : 'Render failed';
      preEl.setAttribute('title', `Mermaid error: ${errorMsg}`);
      console.warn('Mermaid render failed:', error);
    }
  }
}

/** Options for saving a mermaid diagram as a note. */
export interface SaveMermaidOptions {
  app: App;
  mermaidCode: string;
  suggestedTitle?: string;
  targetFolder?: string;
}

/**
 * Extract mermaid code blocks from markdown content.
 */
export function extractMermaidBlocks(markdown: string): string[] {
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mermaidRegex.exec(markdown)) !== null) {
    blocks.push(match[1].trim());
  }

  return blocks;
}

/**
 * Generate a default title from mermaid diagram type.
 */
export function suggestMermaidTitle(mermaidCode: string): string {
  const firstLine = mermaidCode.trim().split('\n')[0].toLowerCase();

  if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) {
    return 'Flowchart';
  } else if (firstLine.startsWith('sequencediagram')) {
    return 'Sequence Diagram';
  } else if (firstLine.startsWith('classdiagram')) {
    return 'Class Diagram';
  } else if (firstLine.startsWith('statediagram')) {
    return 'State Diagram';
  } else if (firstLine.startsWith('erdiagram')) {
    return 'ER Diagram';
  } else if (firstLine.startsWith('gantt')) {
    return 'Gantt Chart';
  } else if (firstLine.startsWith('pie')) {
    return 'Pie Chart';
  } else if (firstLine.startsWith('journey')) {
    return 'User Journey';
  } else if (firstLine.startsWith('gitgraph')) {
    return 'Git Graph';
  } else if (firstLine.startsWith('mindmap')) {
    return 'Mind Map';
  } else if (firstLine.startsWith('timeline')) {
    return 'Timeline';
  } else if (firstLine.startsWith('quadrantchart')) {
    return 'Quadrant Chart';
  } else if (firstLine.startsWith('xychart')) {
    return 'XY Chart';
  } else if (firstLine.startsWith('sankey')) {
    return 'Sankey Diagram';
  }

  return 'Diagram';
}

/**
 * Create markdown content for a mermaid note.
 */
export function createMermaidNoteContent(mermaidCode: string, title: string): string {
  return `# ${title}

\`\`\`mermaid
${mermaidCode}
\`\`\`
`;
}

/**
 * Save a mermaid diagram as a new note.
 */
export async function saveMermaidAsNote(options: SaveMermaidOptions): Promise<string | null> {
  const { app, mermaidCode, suggestedTitle, targetFolder } = options;

  const title = suggestedTitle || suggestMermaidTitle(mermaidCode);
  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `${title} ${timestamp}`;

  // Determine folder
  const folder = targetFolder || '';
  const basePath = folder ? `${folder}/${fileName}` : fileName;

  // Find unique filename
  let filePath = `${basePath}.md`;
  let counter = 1;
  while (app.vault.getAbstractFileByPath(filePath)) {
    filePath = `${basePath} ${counter}.md`;
    counter++;
  }

  // Create the note
  try {
    const content = createMermaidNoteContent(mermaidCode, title);
    await app.vault.create(filePath, content);
    return filePath;
  } catch {
    return null;
  }
}

/**
 * Enhance mermaid elements with action buttons.
 *
 * Call this after renderMermaidBlocks() to add:
 * - Save as note button
 * - Copy source button
 *
 * Works with both:
 * - Rendered diagrams (.cortex-mermaid-diagram with data-mermaid-source)
 * - Unrendered code blocks (pre.mermaid, pre > code.language-mermaid)
 */
export function enhanceMermaidBlocks(
  containerEl: HTMLElement,
  app: App,
  originalMarkdown?: string,
): void {
  // Find rendered diagrams and unrendered code blocks
  const mermaidEls = containerEl.querySelectorAll(
    '.cortex-mermaid-diagram, pre.mermaid, pre code.language-mermaid',
  );

  mermaidEls.forEach((el) => {
    // Skip if already enhanced
    if (el.parentElement?.querySelector('.cortex-mermaid-actions')) return;

    let mermaidCode = '';
    let targetEl: Element = el;

    // Handle rendered diagram
    if (el.classList.contains('cortex-mermaid-diagram')) {
      mermaidCode = (el as HTMLElement).dataset.mermaidSource || '';
      targetEl = el;
    } else {
      // Handle unrendered code block
      const preEl = el.tagName === 'PRE' ? el : el.parentElement;
      if (!preEl) return;
      targetEl = preEl;

      if (el.tagName === 'CODE') {
        mermaidCode = el.textContent || '';
      } else {
        const codeEl = preEl.querySelector('code');
        mermaidCode = codeEl?.textContent || '';
      }
    }

    // If we have original markdown, extract from there as fallback
    if (!mermaidCode && originalMarkdown) {
      const blocks = extractMermaidBlocks(originalMarkdown);
      if (blocks.length > 0) {
        mermaidCode = blocks[0];
      }
    }

    if (!mermaidCode) return;

    // Create actions container
    const actionsEl = createEl('div', { cls: 'cortex-mermaid-actions' });

    // Save as note button
    const saveBtn = actionsEl.createEl('button', {
      cls: 'cortex-mermaid-btn cortex-mermaid-save',
      attr: { title: 'Save as note' },
    });
    setIcon(saveBtn, 'file-plus');

    saveBtn.addEventListener('click', async () => {
      const filePath = await saveMermaidAsNote({
        app,
        mermaidCode,
      });

      if (filePath) {
        saveBtn.classList.add('cortex-mermaid-btn-success');
        setTimeout(() => saveBtn.classList.remove('cortex-mermaid-btn-success'), 1500);
      }
    });

    // Copy source button
    const copyBtn = actionsEl.createEl('button', {
      cls: 'cortex-mermaid-btn cortex-mermaid-copy',
      attr: { title: 'Copy diagram source' },
    });
    setIcon(copyBtn, 'copy');

    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText('```mermaid\n' + mermaidCode + '\n```');
      copyBtn.classList.add('cortex-mermaid-btn-success');
      setTimeout(() => copyBtn.classList.remove('cortex-mermaid-btn-success'), 1500);
    });

    // Insert actions before the target element
    const wrapper = targetEl.parentElement;
    if (wrapper?.classList.contains('cortex-code-wrapper')) {
      wrapper.insertBefore(actionsEl, targetEl);
    } else {
      targetEl.parentElement?.insertBefore(actionsEl, targetEl);
    }
  });
}

/**
 * Check if content contains mermaid blocks.
 */
export function hasMermaidBlocks(markdown: string): boolean {
  return /```mermaid\n[\s\S]*?```/.test(markdown);
}
