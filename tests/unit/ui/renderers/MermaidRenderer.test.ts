import {
  cacheMermaidElements,
  createMermaidNoteContent,
  extractMermaidBlocks,
  hasMermaidBlocks,
  restoreMermaidElements,
  suggestMermaidTitle,
} from '@/ui/renderers/MermaidRenderer';

describe('MermaidRenderer', () => {
  describe('extractMermaidBlocks', () => {
    it('should extract single mermaid block', () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text
`;
      const blocks = extractMermaidBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('graph TD');
    });

    it('should extract multiple mermaid blocks', () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\`
`;
      const blocks = extractMermaidBlocks(markdown);
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toContain('graph TD');
      expect(blocks[1]).toContain('sequenceDiagram');
    });

    it('should return empty array for no mermaid blocks', () => {
      const markdown = `
# Test

\`\`\`javascript
const x = 1;
\`\`\`
`;
      const blocks = extractMermaidBlocks(markdown);
      expect(blocks).toHaveLength(0);
    });

    it('should trim whitespace from extracted blocks', () => {
      const markdown = `\`\`\`mermaid
graph TD
    A --> B

\`\`\``;
      const blocks = extractMermaidBlocks(markdown);
      expect(blocks[0]).toBe('graph TD\n    A --> B');
    });
  });

  describe('suggestMermaidTitle', () => {
    it('should suggest Flowchart for graph/flowchart', () => {
      expect(suggestMermaidTitle('graph TD\nA --> B')).toBe('Flowchart');
      expect(suggestMermaidTitle('flowchart LR\nA --> B')).toBe('Flowchart');
    });

    it('should suggest Sequence Diagram for sequenceDiagram', () => {
      expect(suggestMermaidTitle('sequenceDiagram\nAlice->>Bob: Hi')).toBe('Sequence Diagram');
    });

    it('should suggest Class Diagram for classDiagram', () => {
      expect(suggestMermaidTitle('classDiagram\nclass Animal')).toBe('Class Diagram');
    });

    it('should suggest Gantt Chart for gantt', () => {
      expect(suggestMermaidTitle('gantt\ntitle Project')).toBe('Gantt Chart');
    });

    it('should suggest Mind Map for mindmap', () => {
      expect(suggestMermaidTitle('mindmap\nRoot')).toBe('Mind Map');
    });

    it('should return Diagram for unknown types', () => {
      expect(suggestMermaidTitle('unknownType\nContent')).toBe('Diagram');
    });
  });

  describe('createMermaidNoteContent', () => {
    it('should create note with title and mermaid block', () => {
      const content = createMermaidNoteContent('graph TD\nA --> B', 'My Flowchart');

      expect(content).toContain('# My Flowchart');
      expect(content).toContain('```mermaid');
      expect(content).toContain('graph TD');
      expect(content).toContain('A --> B');
      expect(content).toContain('```');
    });

    it('should preserve mermaid code exactly', () => {
      const mermaidCode = `sequenceDiagram
    Alice->>Bob: Hello Bob
    Bob-->>Alice: Hi Alice`;

      const content = createMermaidNoteContent(mermaidCode, 'Sequence');

      expect(content).toContain(mermaidCode);
    });
  });

  describe('hasMermaidBlocks', () => {
    it('should return true for markdown with mermaid blocks', () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
    A --> B
\`\`\`
`;
      expect(hasMermaidBlocks(markdown)).toBe(true);
    });

    it('should return false for markdown without mermaid blocks', () => {
      const markdown = `
# Test

\`\`\`javascript
const x = 1;
\`\`\`
`;
      expect(hasMermaidBlocks(markdown)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasMermaidBlocks('')).toBe(false);
    });
  });

  // Note: DOM-dependent tests (cacheMermaidElements, restoreMermaidElements)
  // require a browser environment and are tested via integration/E2E tests.
  // The functions use `instanceof HTMLElement` which requires a real DOM.
  describe('cacheMermaidElements', () => {
    it('should return empty map for container without mermaid elements', () => {
      // Mock container that returns empty arrays for all queries
      const container = {
        querySelectorAll: () => [],
      } as unknown as HTMLElement;

      const cache = cacheMermaidElements(container);

      expect(cache.size).toBe(0);
    });
  });

  describe('restoreMermaidElements', () => {
    it('should do nothing with empty cache', () => {
      // Create a mock container
      const container = {
        querySelectorAll: () => [],
      } as unknown as HTMLElement;

      const cache = new Map();
      restoreMermaidElements(container, cache);

      // Should not throw with empty cache
      expect(cache.size).toBe(0);
    });

    it('should skip processing when cache is empty', () => {
      // Create a mock container with some code blocks
      const codeBlocks = [{ parentElement: {}, textContent: 'graph TD' }];
      const container = {
        querySelectorAll: () => codeBlocks,
      } as unknown as HTMLElement;

      const cache = new Map();

      // This should return early without processing codeBlocks
      restoreMermaidElements(container, cache);

      expect(cache.size).toBe(0);
    });
  });
});
