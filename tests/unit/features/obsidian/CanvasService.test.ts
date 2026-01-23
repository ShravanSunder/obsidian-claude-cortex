import type { App, MetadataCache, TFile, Vault } from 'obsidian';
import { CANVAS_DEFAULTS, CanvasService, validateCanvasData } from '@/features/obsidian';

// Mock Obsidian App
function createMockApp(options?: {
  files?: Record<string, string>;
  resolvedLinks?: Record<string, Record<string, number>>;
}): App {
  const { files = {}, resolvedLinks = {} } = options ?? {};
  const createdFiles: Record<string, string> = {};

  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string) => {
        if (files[path] || createdFiles[path]) {
          return { path, extension: path.split('.').pop() } as TFile;
        }
        return null;
      }),
      getFileByPath: vi.fn((path: string) => {
        if (files[path] || createdFiles[path]) {
          return { path, extension: path.split('.').pop() } as TFile;
        }
        return null;
      }),
      read: vi.fn(async (file: TFile) => {
        return files[file.path] ?? createdFiles[file.path] ?? '';
      }),
      modify: vi.fn(async (file: TFile, content: string) => {
        createdFiles[file.path] = content;
      }),
      create: vi.fn(async (path: string, content: string) => {
        createdFiles[path] = content;
        return { path, extension: path.split('.').pop() } as TFile;
      }),
    } as unknown as Vault,
    metadataCache: {
      resolvedLinks,
    } as unknown as MetadataCache,
  } as unknown as App;
}

describe('CanvasService', () => {
  describe('createEmptyCanvas', () => {
    it('should create empty canvas data', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const canvas = service.createEmptyCanvas();

      expect(canvas.nodes).toHaveLength(0);
      expect(canvas.edges).toHaveLength(0);
    });
  });

  describe('createTextNode', () => {
    it('should create text node with defaults', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const node = service.createTextNode({ text: 'Hello' });

      expect(node.type).toBe('text');
      expect(node.text).toBe('Hello');
      expect(node.width).toBe(CANVAS_DEFAULTS.nodeWidth);
      expect(node.height).toBe(CANVAS_DEFAULTS.nodeHeight);
      expect(node.id).toBeDefined();
    });

    it('should create text node with custom position', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const node = service.createTextNode({ text: 'Hello', x: 100, y: 200 });

      expect(node.x).toBe(100);
      expect(node.y).toBe(200);
    });

    it('should create text node with color', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const node = service.createTextNode({ text: 'Hello', color: '1' });

      expect(node.color).toBe('1');
    });
  });

  describe('createFileNode', () => {
    it('should create file node', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const node = service.createFileNode({ file: 'notes/my-note.md' });

      expect(node.type).toBe('file');
      expect(node.file).toBe('notes/my-note.md');
    });

    it('should create file node with subpath', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const node = service.createFileNode({
        file: 'notes/my-note.md',
        subpath: '#heading',
      });

      expect(node.subpath).toBe('#heading');
    });
  });

  describe('createLinkNode', () => {
    it('should create link node', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const node = service.createLinkNode({ url: 'https://example.com' });

      expect(node.type).toBe('link');
      expect(node.url).toBe('https://example.com');
    });
  });

  describe('createGroupNode', () => {
    it('should create group node with label', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const node = service.createGroupNode({ label: 'My Group' });

      expect(node.type).toBe('group');
      expect(node.label).toBe('My Group');
      expect(node.width).toBe(CANVAS_DEFAULTS.nodeWidth * 2);
    });

    it('should create group node with background', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const node = service.createGroupNode({
        background: 'image.png',
        backgroundStyle: 'cover',
      });

      expect(node.background).toBe('image.png');
      expect(node.backgroundStyle).toBe('cover');
    });
  });

  describe('createEdge', () => {
    it('should create edge with defaults', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const edge = service.createEdge({
        fromNode: 'node-1',
        toNode: 'node-2',
      });

      expect(edge.fromNode).toBe('node-1');
      expect(edge.toNode).toBe('node-2');
      expect(edge.fromSide).toBe('right');
      expect(edge.toSide).toBe('left');
    });

    it('should create edge with custom sides', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const edge = service.createEdge({
        fromNode: 'node-1',
        toNode: 'node-2',
        fromSide: 'bottom',
        toSide: 'top',
      });

      expect(edge.fromSide).toBe('bottom');
      expect(edge.toSide).toBe('top');
    });

    it('should create edge with label and color', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const edge = service.createEdge({
        fromNode: 'node-1',
        toNode: 'node-2',
        label: 'connects',
        color: '#ff0000',
      });

      expect(edge.label).toBe('connects');
      expect(edge.color).toBe('#ff0000');
    });
  });

  describe('addNode', () => {
    it('should add node to canvas', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      let canvas = service.createEmptyCanvas();
      const node = service.createTextNode({ text: 'Hello' });
      canvas = service.addNode(canvas, node);

      expect(canvas.nodes).toHaveLength(1);
      expect(canvas.nodes[0].id).toBe(node.id);
    });
  });

  describe('addEdge', () => {
    it('should add edge to canvas', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      let canvas = service.createEmptyCanvas();
      const edge = service.createEdge({ fromNode: 'a', toNode: 'b' });
      canvas = service.addEdge(canvas, edge);

      expect(canvas.edges).toHaveLength(1);
    });
  });

  describe('removeNode', () => {
    it('should remove node and connected edges', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      let canvas = service.createEmptyCanvas();
      const node1 = service.createTextNode({ text: '1' });
      const node2 = service.createTextNode({ text: '2' });
      const edge = service.createEdge({ fromNode: node1.id, toNode: node2.id });

      canvas = service.addNode(canvas, node1);
      canvas = service.addNode(canvas, node2);
      canvas = service.addEdge(canvas, edge);

      canvas = service.removeNode(canvas, node1.id);

      expect(canvas.nodes).toHaveLength(1);
      expect(canvas.edges).toHaveLength(0);
    });
  });

  describe('autoLayoutGrid', () => {
    it('should arrange nodes in grid', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      let canvas = service.createEmptyCanvas();
      for (let i = 0; i < 6; i++) {
        canvas = service.addNode(canvas, service.createTextNode({ text: `Node ${i}` }));
      }

      canvas = service.autoLayoutGrid(canvas, { columns: 3 });

      // Check first row
      expect(canvas.nodes[0].x).toBe(0);
      expect(canvas.nodes[1].x).toBe(CANVAS_DEFAULTS.nodeWidth + CANVAS_DEFAULTS.spacing);
      expect(canvas.nodes[2].x).toBe(2 * (CANVAS_DEFAULTS.nodeWidth + CANVAS_DEFAULTS.spacing));

      // Check second row starts at y > 0
      expect(canvas.nodes[3].y).toBe(CANVAS_DEFAULTS.nodeHeight + CANVAS_DEFAULTS.spacing);
    });

    it('should respect custom start position', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      let canvas = service.createEmptyCanvas();
      canvas = service.addNode(canvas, service.createTextNode({ text: 'Node' }));
      canvas = service.autoLayoutGrid(canvas, { startX: 100, startY: 50 });

      expect(canvas.nodes[0].x).toBe(100);
      expect(canvas.nodes[0].y).toBe(50);
    });
  });

  describe('findNode', () => {
    it('should find node by id', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      let canvas = service.createEmptyCanvas();
      const node = service.createTextNode({ text: 'Find me' });
      canvas = service.addNode(canvas, node);

      const found = service.findNode(canvas, node.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(node.id);
    });

    it('should return undefined for non-existent id', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const canvas = service.createEmptyCanvas();
      const found = service.findNode(canvas, 'non-existent');

      expect(found).toBeUndefined();
    });
  });

  describe('findConnectedEdges', () => {
    it('should find edges connected to a node', () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      let canvas = service.createEmptyCanvas();
      const node1 = service.createTextNode({ text: '1' });
      const node2 = service.createTextNode({ text: '2' });
      const node3 = service.createTextNode({ text: '3' });
      const edge1 = service.createEdge({ fromNode: node1.id, toNode: node2.id });
      const edge2 = service.createEdge({ fromNode: node2.id, toNode: node3.id });

      canvas = service.addNode(canvas, node1);
      canvas = service.addNode(canvas, node2);
      canvas = service.addNode(canvas, node3);
      canvas = service.addEdge(canvas, edge1);
      canvas = service.addEdge(canvas, edge2);

      const connectedEdges = service.findConnectedEdges(canvas, node2.id);

      expect(connectedEdges).toHaveLength(2);
    });
  });

  describe('readCanvas', () => {
    it('should read and parse canvas file', async () => {
      const canvasContent = JSON.stringify({
        nodes: [{ id: '1', type: 'text', text: 'Hello', x: 0, y: 0, width: 250, height: 140 }],
        edges: [],
      });

      const app = createMockApp({
        files: { 'test.canvas': canvasContent },
      });

      const service = new CanvasService(app);
      const canvas = await service.readCanvas('test.canvas');

      expect(canvas).not.toBeNull();
      expect(canvas?.nodes).toHaveLength(1);
    });

    it('should return null for non-existent file', async () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const canvas = await service.readCanvas('nonexistent.canvas');

      expect(canvas).toBeNull();
    });
  });

  describe('writeCanvas', () => {
    it('should write canvas to file', async () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      let canvas = service.createEmptyCanvas();
      canvas = service.addNode(canvas, service.createTextNode({ text: 'Hello' }));

      const result = await service.writeCanvas('output.canvas', canvas);

      expect(result).toBe(true);
      expect(app.vault.create).toHaveBeenCalled();
    });

    it('should add .canvas extension if missing', async () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      const canvas = service.createEmptyCanvas();
      await service.writeCanvas('output', canvas);

      expect(app.vault.create).toHaveBeenCalledWith('output.canvas', expect.any(String));
    });

    it('should reject invalid canvas data', async () => {
      const app = createMockApp();
      const service = new CanvasService(app);

      // Create canvas with invalid node (missing required fields)
      const invalidCanvas = {
        nodes: [{ id: '1', type: 'text' }], // Missing x, y, width, height
        edges: [],
      };

      const result = await service.writeCanvas('output.canvas', invalidCanvas as never);

      expect(result).toBe(false);
    });
  });
});

describe('validateCanvasData', () => {
  it('should return empty array for valid canvas', () => {
    const canvas = {
      nodes: [
        { id: '1', type: 'text', text: 'Hello', x: 0, y: 0, width: 250, height: 140 },
        { id: '2', type: 'file', file: 'test.md', x: 300, y: 0, width: 250, height: 140 },
      ],
      edges: [{ id: 'e1', fromNode: '1', toNode: '2' }],
    };

    const errors = validateCanvasData(canvas);
    expect(errors).toHaveLength(0);
  });

  it('should detect missing nodes array', () => {
    const errors = validateCanvasData({ edges: [] });
    expect(errors).toContain('Canvas must have a nodes array');
  });

  it('should detect missing edges array', () => {
    const errors = validateCanvasData({ nodes: [] });
    expect(errors).toContain('Canvas must have an edges array');
  });

  it('should detect missing node id', () => {
    const canvas = {
      nodes: [{ type: 'text', text: 'Hello', x: 0, y: 0, width: 250, height: 140 }],
      edges: [],
    };
    const errors = validateCanvasData(canvas);
    expect(errors).toContain('Node 0: missing id');
  });

  it('should detect invalid node type', () => {
    const canvas = {
      nodes: [{ id: '1', type: 'invalid', x: 0, y: 0, width: 250, height: 140 }],
      edges: [],
    };
    const errors = validateCanvasData(canvas);
    expect(errors).toContain('Node 0: invalid type "invalid"');
  });

  it('should detect missing edge fromNode', () => {
    const canvas = {
      nodes: [],
      edges: [{ id: 'e1', toNode: '2' }],
    };
    const errors = validateCanvasData(canvas);
    expect(errors).toContain('Edge 0: missing fromNode');
  });

  it('should reject non-object data', () => {
    const errors = validateCanvasData('not an object');
    expect(errors).toContain('Canvas data must be an object');
  });
});
