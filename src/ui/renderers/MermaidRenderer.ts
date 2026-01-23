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

/** Information about a mermaid render error. */
export interface MermaidRenderError {
  /** Unique ID for this mermaid diagram. */
  id: string;
  /** The mermaid source code that failed. */
  code: string;
  /** The error message. */
  error: string;
  /** The DOM element containing the error. */
  element: HTMLElement;
}

/** Result of rendering mermaid blocks. */
export interface RenderMermaidResult {
  /** Number of successfully rendered diagrams. */
  rendered: number;
  /** Array of render errors. */
  errors: MermaidRenderError[];
}

/**
 * Type guard to check if an element is an HTMLElement.
 */
function isHTMLElement(el: Element | null | undefined): el is HTMLElement {
  return el instanceof HTMLElement;
}

/**
 * Type guard to check if an element is an SVGElement.
 */
function isSVGElement(el: Element | Node | null | undefined): el is SVGElement {
  return el instanceof SVGElement;
}

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
 * @returns Result with count of rendered diagrams and any errors.
 */
export async function renderMermaidBlocks(containerEl: HTMLElement): Promise<RenderMermaidResult> {
  const codeBlocks = Array.from(containerEl.querySelectorAll('pre > code.language-mermaid'));
  const result: RenderMermaidResult = { rendered: 0, errors: [] };

  // Debug: Check what Obsidian created
  const obsidianMermaid = containerEl.querySelectorAll('.mermaid, .mermaid, [class*="mermaid"]');
  const svgs = containerEl.querySelectorAll('svg');
  console.log(
    '[MermaidRenderer] renderMermaidBlocks called, found',
    codeBlocks.length,
    'code blocks,',
    obsidianMermaid.length,
    'obsidian mermaid elements,',
    svgs.length,
    'SVGs',
  );

  // Log first few element classes for debugging
  if (obsidianMermaid.length > 0) {
    console.log(
      '[MermaidRenderer] Obsidian mermaid element classes:',
      Array.from(obsidianMermaid)
        .slice(0, 3)
        .map((el) => el.className),
    );
  }

  for (const codeEl of codeBlocks) {
    const preEl = codeEl.parentElement;
    if (!preEl) continue;

    const code = codeEl.textContent ?? '';
    if (!code.trim()) continue;

    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const { svg } = await mermaid.render(id, code);
      const wrapper = document.createElement('div');
      wrapper.className = 'cortex-mermaid-diagram';
      // Store original code and ID for save/copy functionality
      wrapper.dataset.mermaidSource = code;
      wrapper.dataset.mermaidId = id;
      wrapper.innerHTML = svg;
      preEl.replaceWith(wrapper);
      console.log(
        '[MermaidRenderer] Rendered mermaid diagram, wrapper classes:',
        wrapper.className,
      );
      result.rendered++;
    } catch (error) {
      // Keep original code block on error, add error indicator
      preEl.classList.add('cortex-mermaid-error');
      const errorMsg = error instanceof Error ? error.message : 'Render failed';
      preEl.setAttribute('title', `Mermaid error: ${errorMsg}`);
      console.warn('Mermaid render failed:', error);

      // Track the error for auto-fix
      result.errors.push({
        id,
        code,
        error: errorMsg,
        element: preEl,
      });
    }
  }

  return result;
}

/**
 * Renders a single mermaid diagram and returns the wrapper element.
 * Used for in-place replacement during auto-fix.
 * @param code - The mermaid source code.
 * @param id - Optional ID for the diagram (generated if not provided).
 * @returns The wrapper HTMLElement containing the rendered SVG.
 * @throws Error if rendering fails.
 */
export async function renderSingleMermaid(code: string, id?: string): Promise<HTMLElement> {
  const mermaidId = id ?? `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { svg } = await mermaid.render(mermaidId, code);

  const wrapper = document.createElement('div');
  wrapper.className = 'cortex-mermaid-diagram cortex-mermaid-fade-in';
  wrapper.dataset.mermaidSource = code;
  wrapper.dataset.mermaidId = mermaidId;
  wrapper.innerHTML = svg;

  return wrapper;
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
 * Convert SVG element to PNG blob.
 */
async function svgToPngBlob(svgEl: SVGElement, scale = 2): Promise<Blob> {
  // Get SVG dimensions - try viewBox first, then clientWidth/Height
  const viewBox = svgEl.getAttribute('viewBox');
  let width = 800;
  let height = 600;

  if (viewBox) {
    const parts = viewBox.split(/\s+/);
    if (parts.length >= 4) {
      width = parseFloat(parts[2]) ?? width;
      height = parseFloat(parts[3]) ?? height;
    }
  } else {
    width = svgEl.clientWidth ?? width;
    height = svgEl.clientHeight ?? height;
  }

  // Clone SVG and set explicit dimensions
  const clonedNode = svgEl.cloneNode(true);
  if (!isSVGElement(clonedNode)) {
    throw new Error('Failed to clone SVG element');
  }
  clonedNode.setAttribute('width', String(width));
  clonedNode.setAttribute('height', String(height));

  // Serialize to string
  const svgData = new XMLSerializer().serializeToString(clonedNode);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  // Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  ctx.scale(scale, scale);

  // Fill with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };
    img.src = url;
  });
}

/**
 * Copy SVG diagram as PNG image to clipboard.
 */
async function copyDiagramAsImage(svgEl: SVGElement): Promise<boolean> {
  try {
    const blob = await svgToPngBlob(svgEl);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch (error) {
    console.error('Failed to copy diagram as image:', error);
    return false;
  }
}

/**
 * Enhance mermaid elements with action buttons.
 *
 * Call this after renderMermaidBlocks() to add:
 * - Expand button (opens in modal)
 * - Copy source button
 * - Copy as image button
 * - Save as note button
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
  // Find rendered diagrams - both Cortex-rendered and Obsidian-rendered
  const mermaidEls = containerEl.querySelectorAll(
    '.cortex-mermaid-diagram, .mermaid, pre.mermaid, pre code.language-mermaid',
  );

  // Pre-extract mermaid blocks from original markdown for index matching
  const markdownBlocks = originalMarkdown ? extractMermaidBlocks(originalMarkdown) : [];

  // Track index for Obsidian-rendered diagrams that need fallback to markdown blocks
  let obsidianDiagramIndex = 0;

  mermaidEls.forEach((el) => {
    // Skip if already enhanced or not an HTMLElement
    if (!isHTMLElement(el)) return;
    if (el.querySelector('.cortex-mermaid-actions')) return;

    let mermaidCode = '';
    let targetEl: HTMLElement = el;

    // Handle Cortex-rendered diagram
    if (el.classList.contains('cortex-mermaid-diagram')) {
      mermaidCode = el.dataset.mermaidSource ?? '';
      targetEl = el;
    }
    // Handle Obsidian-rendered diagram (.mermaid)
    else if (el.classList.contains('mermaid')) {
      targetEl = el;
      // Use corresponding block from originalMarkdown by index
      if (markdownBlocks.length > obsidianDiagramIndex) {
        mermaidCode = markdownBlocks[obsidianDiagramIndex];
        // Store on element for later retrieval (survives DOM rebuilds)
        el.dataset.mermaidSource = mermaidCode;
      }
      // Assign a stable ID to the SVG for direct lookup (Obsidian doesn't set one)
      const obsidianSvg = el.querySelector('svg');
      if (isSVGElement(obsidianSvg) && !obsidianSvg.id) {
        const generatedId = `mermaid-obs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        obsidianSvg.id = generatedId;
        el.dataset.mermaidId = generatedId;
      } else if (isSVGElement(obsidianSvg) && obsidianSvg.id) {
        el.dataset.mermaidId = obsidianSvg.id;
      }
      obsidianDiagramIndex++;
    }
    // Handle unrendered code block
    else {
      const preEl = el.tagName === 'PRE' ? el : el.parentElement;
      if (!isHTMLElement(preEl)) return;
      targetEl = preEl;

      if (el.tagName === 'CODE') {
        mermaidCode = el.textContent ?? '';
      } else {
        const codeEl = preEl.querySelector('code');
        mermaidCode = codeEl?.textContent ?? '';
      }
    }

    if (!mermaidCode) {
      return;
    }

    const svgEl = targetEl.querySelector('svg');
    const hasSvg = isSVGElement(svgEl);
    const isRenderedDiagram =
      el.classList.contains('cortex-mermaid-diagram') || el.classList.contains('mermaid');

    // Create actions container - position inside the diagram container
    const actionsEl = createEl('div', { cls: 'cortex-mermaid-actions' });

    // Only show buttons for rendered diagrams with SVG
    if (isRenderedDiagram && hasSvg) {
      // Store mermaidId for direct SVG lookup (stable across DOM rebuilds)
      const mermaidId = el.dataset.mermaidId ?? '';
      const capturedCode = mermaidCode;

      // Expand button
      const expandBtn = actionsEl.createEl('button', {
        cls: 'cortex-mermaid-btn',
        attr: { title: 'Expand' },
      });
      setIcon(expandBtn, 'maximize-2');
      expandBtn.dataset.mermaidId = mermaidId;

      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const btnMermaidId = expandBtn.dataset.mermaidId;
        const svg = btnMermaidId ? document.getElementById(btnMermaidId) : null;
        void showMermaidModal(svg, capturedCode, app);
      });

      // Copy as 2x image button
      const copyImageBtn = actionsEl.createEl('button', {
        cls: 'cortex-mermaid-btn',
        attr: { title: 'Copy 2x' },
      });
      setIcon(copyImageBtn, 'image');
      copyImageBtn.dataset.mermaidId = mermaidId;

      copyImageBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const btnMermaidId = copyImageBtn.dataset.mermaidId;
          let currentSvg: Element | null = btnMermaidId
            ? document.getElementById(btnMermaidId)
            : null;

          // Fallback: re-render if SVG not found (stale element)
          if (!isSVGElement(currentSvg) && capturedCode) {
            const id = `mermaid-copy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const { svg } = await mermaid.render(id, capturedCode);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svg;
            currentSvg = tempDiv.querySelector('svg');
          }

          if (isSVGElement(currentSvg)) {
            const success = await copyDiagramAsImage(currentSvg);
            if (success) {
              copyImageBtn.classList.add('cortex-mermaid-btn-success');
              setTimeout(() => copyImageBtn.classList.remove('cortex-mermaid-btn-success'), 1500);
            }
          }
        } catch (error) {
          console.error('Failed to copy diagram as image:', error);
        }
      });

      // Copy code button
      const copyCodeBtn = actionsEl.createEl('button', {
        cls: 'cortex-mermaid-btn',
        attr: { title: 'Copy code' },
      });
      setIcon(copyCodeBtn, 'code');

      copyCodeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText('```mermaid\n' + mermaidCode + '\n```');
        copyCodeBtn.classList.add('cortex-mermaid-btn-success');
        setTimeout(() => copyCodeBtn.classList.remove('cortex-mermaid-btn-success'), 1500);
      });
    }

    // Only insert actions if there are buttons (rendered diagrams with SVG only)
    if (isRenderedDiagram && hasSvg) {
      targetEl.insertBefore(actionsEl, targetEl.firstChild);
    }
  });
}

/**
 * Check if content contains mermaid blocks.
 */
export function hasMermaidBlocks(markdown: string): boolean {
  return /```mermaid\n[\s\S]*?```/.test(markdown);
}

/**
 * Show placeholder indicators for mermaid blocks during streaming.
 * Hides the code block and shows a "Generating diagram..." message.
 */
export function showMermaidPlaceholders(containerEl: HTMLElement): void {
  const codeBlocks = Array.from(containerEl.querySelectorAll('pre > code.language-mermaid'));

  for (const codeEl of codeBlocks) {
    const preEl = codeEl.parentElement;
    if (!preEl) continue;

    // Skip if already has a placeholder
    if (preEl.previousElementSibling?.classList.contains('cortex-mermaid-placeholder')) continue;

    // Mark the pre element to hide it via CSS
    preEl.classList.add('cortex-mermaid-generating');

    // Add visual placeholder indicator
    const placeholder = document.createElement('div');
    placeholder.className = 'cortex-mermaid-placeholder';
    placeholder.innerHTML =
      '<span class="cortex-mermaid-spinner"></span> <span>Generating diagram...</span>';
    preEl.parentElement?.insertBefore(placeholder, preEl);
  }
}

/**
 * Remove mermaid placeholders (called before final render).
 */
export function removeMermaidPlaceholders(containerEl: HTMLElement): void {
  // Remove placeholder elements
  const placeholders = Array.from(containerEl.querySelectorAll('.cortex-mermaid-placeholder'));
  for (const placeholder of placeholders) {
    placeholder.remove();
  }

  // Remove generating class from pre elements
  const generatingBlocks = Array.from(
    containerEl.querySelectorAll('pre.cortex-mermaid-generating'),
  );
  for (const block of generatingBlocks) {
    block.classList.remove('cortex-mermaid-generating');
  }
}

// ============================================
// Mermaid Caching Utilities
// ============================================

/** Cache entry for mermaid elements. */
export interface MermaidCacheEntry {
  /** Hash of the mermaid source code for matching. */
  hash: string;
  /** The cached DOM element (placeholder or rendered diagram). */
  element: HTMLElement;
  /** Whether this is a rendered diagram (vs placeholder). */
  isRendered: boolean;
}

/**
 * Simple hash function for mermaid source code.
 * Uses djb2 algorithm for fast string hashing.
 */
function hashMermaidSource(source: string): string {
  let hash = 5381;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 33) ^ source.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Caches mermaid elements (placeholders or rendered diagrams) before el.empty().
 * Uses content hash to match blocks across re-renders.
 *
 * @param containerEl - The container element to search for mermaid elements.
 * @returns Map of hash -> cached element entry.
 */
export function cacheMermaidElements(containerEl: HTMLElement): Map<string, MermaidCacheEntry> {
  const cache = new Map<string, MermaidCacheEntry>();

  // Cache rendered diagrams
  const diagrams = Array.from(containerEl.querySelectorAll('.cortex-mermaid-diagram'));
  for (const diagram of diagrams) {
    if (!isHTMLElement(diagram)) continue;
    const source = diagram.dataset.mermaidSource;
    if (!source) continue;

    const hash = hashMermaidSource(source);
    cache.set(hash, {
      hash,
      element: diagram.cloneNode(true) as HTMLElement,
      isRendered: true,
    });
  }

  // Cache placeholders with their associated code blocks
  const placeholders = Array.from(containerEl.querySelectorAll('.cortex-mermaid-placeholder'));
  for (const placeholder of placeholders) {
    if (!isHTMLElement(placeholder)) continue;

    // Find the associated code block (should be next sibling)
    const codeBlock = placeholder.nextElementSibling;
    if (!codeBlock || !isHTMLElement(codeBlock)) continue;

    const codeEl = codeBlock.querySelector('code.language-mermaid');
    if (!codeEl) continue;

    const source = codeEl.textContent ?? '';
    if (!source.trim()) continue;

    const hash = hashMermaidSource(source);
    // Only cache if not already cached (rendered diagrams take precedence)
    if (!cache.has(hash)) {
      cache.set(hash, {
        hash,
        element: placeholder.cloneNode(true) as HTMLElement,
        isRendered: false,
      });
    }
  }

  return cache;
}

/**
 * Restores cached mermaid elements after renderMarkdown().
 * Matches by source hash and replaces new code blocks with cached elements.
 *
 * @param containerEl - The container element to search for mermaid code blocks.
 * @param cache - Map of hash -> cached element entry.
 */
export function restoreMermaidElements(
  containerEl: HTMLElement,
  cache: Map<string, MermaidCacheEntry>,
): void {
  if (cache.size === 0) return;

  const codeBlocks = Array.from(containerEl.querySelectorAll('pre > code.language-mermaid'));

  for (const codeEl of codeBlocks) {
    const preEl = codeEl.parentElement;
    if (!preEl) continue;

    const source = codeEl.textContent ?? '';
    if (!source.trim()) continue;

    const hash = hashMermaidSource(source);
    const cached = cache.get(hash);

    if (cached) {
      if (cached.isRendered) {
        // Restore rendered diagram with fade-in animation
        const restored = cached.element.cloneNode(true) as HTMLElement;
        restored.classList.add('cortex-mermaid-fade-in');
        preEl.replaceWith(restored);

        // Remove animation class after animation completes
        setTimeout(() => {
          restored.classList.remove('cortex-mermaid-fade-in');
        }, 200);
      } else {
        // Restore placeholder - insert before the code block
        const restored = cached.element.cloneNode(true) as HTMLElement;
        preEl.classList.add('cortex-mermaid-generating');
        preEl.parentElement?.insertBefore(restored, preEl);
      }
    }
  }
}

/**
 * Show mermaid diagram in fullscreen modal with action buttons.
 * Clones the provided SVG element when available, falls back to re-rendering.
 */
async function showMermaidModal(
  sourceSvg: Element | null,
  mermaidCode: string,
  _app: App,
): Promise<void> {
  if (!mermaidCode) {
    console.error('[MermaidRenderer] showMermaidModal: No mermaidCode provided');
    return;
  }

  // Use Obsidian's native modal pattern - append to body like Obsidian does
  const overlay = document.body.createDiv({ cls: 'modal-container mod-dim' });
  const modalBg = overlay.createDiv({ cls: 'modal-bg' });
  modalBg.style.opacity = '0.85';
  const modal = overlay.createDiv({ cls: 'modal cortex-mermaid-modal' });

  // Modal header with actions
  const header = modal.createDiv({ cls: 'cortex-mermaid-modal-header' });
  const title = header.createDiv({ cls: 'cortex-mermaid-modal-title' });
  title.setText(suggestMermaidTitle(mermaidCode));

  const actionsContainer = header.createDiv({ cls: 'cortex-mermaid-modal-actions' });

  // Modal body
  const body = modal.createDiv({ cls: 'cortex-mermaid-modal-body' });

  // Clone the provided SVG element directly
  let validSvgEl: SVGElement | null = null;
  if (isSVGElement(sourceSvg)) {
    const cloned = sourceSvg.cloneNode(true);
    if (isSVGElement(cloned)) {
      validSvgEl = cloned;
    }
  }

  // Fallback: re-render only if no SVG found
  if (!validSvgEl && mermaidCode) {
    try {
      const id = `mermaid-modal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, mermaidCode);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = svg;
      const rendered = tempDiv.querySelector('svg');
      if (isSVGElement(rendered)) {
        validSvgEl = rendered;
      }
    } catch (error) {
      console.error('[MermaidRenderer] Fallback render failed:', error);
    }
  }

  // Copy as image button
  if (validSvgEl) {
    const copyImageBtn = actionsContainer.createEl('button', {
      cls: 'cortex-mermaid-modal-btn',
      attr: { title: 'Copy as image' },
    });
    setIcon(copyImageBtn, 'image');
    copyImageBtn.createSpan({ text: 'Copy Image' });

    copyImageBtn.addEventListener('click', async () => {
      const success = await copyDiagramAsImage(validSvgEl);
      if (success) {
        copyImageBtn.classList.add('cortex-mermaid-modal-btn-success');
        setTimeout(() => copyImageBtn.classList.remove('cortex-mermaid-modal-btn-success'), 1500);
      }
    });
  }

  // Copy code button
  const copyCodeBtn = actionsContainer.createEl('button', {
    cls: 'cortex-mermaid-modal-btn',
    attr: { title: 'Copy code' },
  });
  setIcon(copyCodeBtn, 'code');
  copyCodeBtn.createSpan({ text: 'Copy Code' });

  copyCodeBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText('```mermaid\n' + mermaidCode + '\n```');
    copyCodeBtn.classList.add('cortex-mermaid-modal-btn-success');
    setTimeout(() => copyCodeBtn.classList.remove('cortex-mermaid-modal-btn-success'), 1500);
  });

  // Close button
  const closeBtn = actionsContainer.createEl('button', { cls: 'cortex-mermaid-modal-close' });
  closeBtn.setText('\u00D7');

  // Populate body with SVG
  if (validSvgEl) {
    // Set size for modal view
    validSvgEl.style.maxWidth = 'none';
    validSvgEl.style.width = 'auto';
    validSvgEl.style.height = 'auto';
    // Wrap in .mermaid div so Obsidian's dark mode filter applies
    const mermaidWrapper = body.createDiv({ cls: 'mermaid' });
    mermaidWrapper.appendChild(validSvgEl);
  } else {
    body.createEl('p', { text: 'Unable to render diagram', cls: 'cortex-mermaid-modal-error' });
  }

  const close = () => {
    document.removeEventListener('keydown', handleEsc);
    overlay.remove();
  };

  closeBtn.addEventListener('click', close);

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // ESC to close
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    }
  };
  document.addEventListener('keydown', handleEsc);
}
