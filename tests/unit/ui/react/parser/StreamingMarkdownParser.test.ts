/**
 * Tests for StreamingMarkdownParser
 *
 * Verifies the parser correctly detects block boundaries, handles
 * edge cases, and emits proper events during streaming.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  type BlockEvent,
  djb2Hash,
  generateBlockId,
  StreamingMarkdownParser,
} from '../../../../../src/ui/react/parser';

describe('StreamingMarkdownParser', () => {
  let parser: StreamingMarkdownParser;

  beforeEach(() => {
    parser = new StreamingMarkdownParser();
  });

  describe('basic prose parsing', () => {
    it('should parse simple prose text', () => {
      const events = parser.push('Hello world\n');
      parser.end();

      expect(events.length).toBeGreaterThan(0);
      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('prose');
      expect(blocks[0].content).toContain('Hello world');
    });

    it('should emit block_start for new prose', () => {
      const events = parser.push('Hello\n');

      const startEvent = events.find((e) => e.type === 'block_start');
      expect(startEvent).toBeDefined();
      if (startEvent?.type === 'block_start') {
        expect(startEvent.block.type).toBe('prose');
      }
    });

    it('should emit block_delta for prose content', () => {
      const events = parser.push('Hello\n');

      const deltaEvent = events.find((e) => e.type === 'block_delta');
      expect(deltaEvent).toBeDefined();
      if (deltaEvent?.type === 'block_delta') {
        expect(deltaEvent.delta).toContain('Hello');
      }
    });

    it('should handle multi-line prose', () => {
      parser.push('Line 1\n');
      parser.push('Line 2\n');
      parser.push('Line 3\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain('Line 1');
      expect(blocks[0].content).toContain('Line 2');
      expect(blocks[0].content).toContain('Line 3');
    });

    it('should handle character-level streaming in prose', () => {
      // Simulate character-by-character streaming
      parser.push('H');
      parser.push('e');
      parser.push('l');
      parser.push('l');
      parser.push('o');
      parser.push('\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain('Hello');
    });
  });

  describe('code fence detection', () => {
    it('should detect code fence start', () => {
      const events = parser.push('```javascript\n');

      const startEvent = events.find((e) => e.type === 'block_start');
      expect(startEvent).toBeDefined();
      if (startEvent?.type === 'block_start') {
        expect(startEvent.block.type).toBe('code');
        expect(startEvent.block.language).toBe('javascript');
      }
    });

    it('should detect code fence without language', () => {
      const events = parser.push('```\n');

      const startEvent = events.find((e) => e.type === 'block_start');
      expect(startEvent).toBeDefined();
      if (startEvent?.type === 'block_start') {
        expect(startEvent.block.type).toBe('code');
        expect(startEvent.block.language).toBeUndefined();
      }
    });

    it('should parse complete code block', () => {
      parser.push('```javascript\n');
      parser.push('const x = 1;\n');
      parser.push('```\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[0].content).toContain('const x = 1;');
      expect(blocks[0].state).toBe('complete');
    });

    it('should handle code block with multiple lines', () => {
      parser.push('```typescript\n');
      parser.push('function foo() {\n');
      parser.push('  return 42;\n');
      parser.push('}\n');
      parser.push('```\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain('function foo()');
      expect(blocks[0].content).toContain('return 42');
    });

    it('should handle incomplete code fence at end of stream', () => {
      parser.push('```python\n');
      parser.push('print("hello")\n');
      // No closing fence
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
      expect(blocks[0].state).toBe('complete'); // Completed by end()
    });
  });

  describe('mermaid detection', () => {
    it('should detect mermaid blocks', () => {
      const events = parser.push('```mermaid\n');

      const startEvent = events.find((e) => e.type === 'block_start');
      expect(startEvent).toBeDefined();
      if (startEvent?.type === 'block_start') {
        expect(startEvent.block.type).toBe('mermaid');
        expect(startEvent.block.language).toBe('mermaid');
      }
    });

    it('should parse complete mermaid block', () => {
      parser.push('```mermaid\n');
      parser.push('graph TD\n');
      parser.push('  A --> B\n');
      parser.push('```\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('mermaid');
      expect(blocks[0].content).toContain('graph TD');
    });

    it('should handle mermaid detection case-insensitively', () => {
      const events = parser.push('```Mermaid\n');

      const startEvent = events.find((e) => e.type === 'block_start');
      if (startEvent?.type === 'block_start') {
        expect(startEvent.block.type).toBe('mermaid');
      }
    });

    it('should respect detectMermaid option', () => {
      const noMermaidParser = new StreamingMarkdownParser({
        detectMermaid: false,
      });
      const events = noMermaidParser.push('```mermaid\n');

      const startEvent = events.find((e) => e.type === 'block_start');
      if (startEvent?.type === 'block_start') {
        expect(startEvent.block.type).toBe('code');
      }
    });
  });

  describe('mixed content', () => {
    it('should handle prose followed by code', () => {
      parser.push('Here is some code:\n');
      parser.push('```javascript\n');
      parser.push('const x = 1;\n');
      parser.push('```\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('prose');
      expect(blocks[1].type).toBe('code');
    });

    it('should handle code followed by prose', () => {
      parser.push('```javascript\n');
      parser.push('const x = 1;\n');
      parser.push('```\n');
      parser.push('That was some code.\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('code');
      expect(blocks[1].type).toBe('prose');
    });

    it('should handle multiple code blocks', () => {
      parser.push('```javascript\n');
      parser.push('const a = 1;\n');
      parser.push('```\n');
      parser.push('And another:\n');
      parser.push('```python\n');
      parser.push('x = 2\n');
      parser.push('```\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe('code');
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[1].type).toBe('prose');
      expect(blocks[2].type).toBe('code');
      expect(blocks[2].language).toBe('python');
    });

    it('should handle complex mixed content', () => {
      parser.push('# Introduction\n');
      parser.push('\n');
      parser.push('Here is a diagram:\n');
      parser.push('```mermaid\n');
      parser.push('graph TD\n');
      parser.push('```\n');
      parser.push('\n');
      parser.push('And some code:\n');
      parser.push('```typescript\n');
      parser.push('const x = 1;\n');
      parser.push('```\n');
      parser.push('\n');
      parser.push('The end.\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks.length).toBeGreaterThanOrEqual(4);

      const types = blocks.map((b) => b.type);
      expect(types).toContain('prose');
      expect(types).toContain('mermaid');
      expect(types).toContain('code');
    });
  });

  describe('streaming state', () => {
    it('should track streaming state correctly', () => {
      parser.push('```javascript\n');
      parser.push('const x = 1;\n');

      // Block is still streaming
      const current = parser.getCurrentBlock();
      expect(current).not.toBeNull();
      expect(current?.state).toBe('streaming');

      parser.push('```\n');

      // Block is now complete
      const completed = parser.getBlocks();
      expect(completed).toHaveLength(1);
      expect(completed[0].state).toBe('complete');
    });

    it('should emit block_complete event', () => {
      const allEvents: BlockEvent[] = [];
      allEvents.push(...parser.push('```javascript\n'));
      allEvents.push(...parser.push('const x = 1;\n'));
      allEvents.push(...parser.push('```\n'));

      const completeEvents = allEvents.filter((e) => e.type === 'block_complete');
      expect(completeEvents).toHaveLength(1);
    });

    it('should provide all blocks including current', () => {
      parser.push('Some prose\n');
      parser.push('```javascript\n');
      parser.push('const x = 1;\n');

      const all = parser.getAllBlocks();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const events = parser.push('');
      parser.end();

      expect(events).toHaveLength(0);
      expect(parser.getBlocks()).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      parser.push('   \n');
      parser.push('\n');
      parser.push('\t\n');
      parser.end();

      const blocks = parser.getBlocks();
      // Whitespace-only lines may or may not create blocks depending on implementation
      // The key is it shouldn't crash
      expect(blocks).toBeDefined();
    });

    it('should handle fence-like content inside code blocks', () => {
      // In standard markdown, ``` on its own line always closes a code block
      // To include literal ```, the example would need different delimiters
      parser.push('```markdown\n');
      parser.push('Here is a code block:\n');
      parser.push('```javascript\n'); // This has content after, stays in block
      parser.push('const x = 1;\n');
      parser.push('```\n'); // This closes the markdown block (bare fence)
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
      expect(blocks[0].language).toBe('markdown');
      // The content should include the "```javascript" as literal text
      expect(blocks[0].content).toContain('```javascript');
    });

    it('should handle very long lines', () => {
      const longLine = 'x'.repeat(10000) + '\n';
      parser.push(longLine);
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content.length).toBeGreaterThan(9000);
    });

    it('should handle special characters', () => {
      parser.push('Special chars: <>&"\'`\n');
      parser.push('Unicode: 你好 🎉 émojis\n');
      parser.end();

      const blocks = parser.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain('<>&');
      expect(blocks[0].content).toContain('你好');
    });

    it('should reset cleanly', () => {
      parser.push('Some content\n');
      parser.push('```javascript\n');
      parser.push('code\n');
      parser.end();

      parser.reset();

      expect(parser.getBlocks()).toHaveLength(0);
      expect(parser.getCurrentBlock()).toBeNull();

      // Should work after reset
      parser.push('New content\n');
      parser.end();

      expect(parser.getBlocks()).toHaveLength(1);
    });
  });

  describe('block indexing', () => {
    it('should assign sequential indices to blocks', () => {
      parser.push('Prose 1\n');
      parser.push('```javascript\n');
      parser.push('code\n');
      parser.push('```\n');
      parser.push('Prose 2\n');
      parser.end();

      const blocks = parser.getBlocks();
      const indices = blocks.map((b) => b.index);

      // Indices should be sequential and unique
      expect(indices.length).toBe(new Set(indices).size);
      expect(Math.min(...indices)).toBe(0);
    });
  });
});

describe('hash utilities', () => {
  describe('djb2Hash', () => {
    it('should produce consistent hashes', () => {
      const hash1 = djb2Hash('hello');
      const hash2 = djb2Hash('hello');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different strings', () => {
      const hash1 = djb2Hash('hello');
      const hash2 = djb2Hash('world');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = djb2Hash('');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should handle unicode', () => {
      const hash = djb2Hash('你好世界');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('generateBlockId', () => {
    it('should generate consistent IDs', () => {
      const id1 = generateBlockId('content', 0, 'prose');
      const id2 = generateBlockId('content', 0, 'prose');
      expect(id1).toBe(id2);
    });

    it('should include block type in ID', () => {
      const proseId = generateBlockId('content', 0, 'prose');
      const codeId = generateBlockId('content', 0, 'code');

      expect(proseId).toContain('prose');
      expect(codeId).toContain('code');
    });

    it('should include index in ID', () => {
      const id0 = generateBlockId('content', 0, 'prose');
      const id1 = generateBlockId('content', 1, 'prose');

      expect(id0).toContain('0');
      expect(id1).toContain('1');
    });

    it('should use content prefix for hashing', () => {
      // Same 50-char prefix, different suffix should have same hash
      const prefix = 'x'.repeat(50); // Exactly 50 chars
      const id1 = generateBlockId(prefix + 'aaaa', 0, 'prose');
      const id2 = generateBlockId(prefix + 'bbbb', 0, 'prose');

      // The content prefix (first 50 chars) is the same
      expect(id1).toBe(id2);
    });
  });
});
