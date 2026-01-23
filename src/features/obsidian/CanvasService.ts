/**
 * Canvas Service
 *
 * Provides utilities for creating and modifying Obsidian Canvas files.
 * Canvas files are JSON documents with nodes and edges.
 */

import type { App, TFile } from 'obsidian';
import type {
  AllCanvasNodeData,
  CanvasData,
  CanvasEdgeData,
  CanvasFileData,
  CanvasGroupData,
  CanvasLinkData,
  CanvasTextData,
  NodeSide,
} from 'obsidian/canvas';

/** Default canvas dimensions. */
export const CANVAS_DEFAULTS = {
  nodeWidth: 250,
  nodeHeight: 140,
  spacing: 50,
} as const;

/** Canvas color presets (1-6). */
export const CANVAS_COLORS = {
  1: '#fb464c', // Red
  2: '#e9973f', // Orange
  3: '#e0de71', // Yellow
  4: '#44cf6e', // Green
  5: '#53dfdd', // Cyan
  6: '#a882ff', // Purple
} as const;

/** Options for creating a text node. */
export interface CreateTextNodeOptions {
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
}

/** Options for creating a file node. */
export interface CreateFileNodeOptions {
  file: string;
  subpath?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
}

/** Options for creating a link node. */
export interface CreateLinkNodeOptions {
  url: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
}

/** Options for creating a group node. */
export interface CreateGroupNodeOptions {
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  background?: string;
  backgroundStyle?: 'cover' | 'ratio' | 'repeat';
}

/** Options for creating an edge. */
export interface CreateEdgeOptions {
  fromNode: string;
  toNode: string;
  fromSide?: NodeSide;
  toSide?: NodeSide;
  label?: string;
  color?: string;
}

/** Options for auto-layout. */
export interface AutoLayoutOptions {
  startX?: number;
  startY?: number;
  columns?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  spacing?: number;
}

/**
 * Validate canvas data structure.
 * @param data - Unknown data to validate.
 * @returns Array of error messages if invalid, empty array if valid.
 */
export function validateCanvasData(data: unknown): string[] {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return ['Canvas data must be an object'];
  }

  const canvas = data as Record<string, unknown>;

  // Validate nodes array
  if (!Array.isArray(canvas.nodes)) {
    errors.push('Canvas must have a nodes array');
  } else {
    for (const [i, node] of canvas.nodes.entries()) {
      if (!node || typeof node !== 'object') {
        errors.push(`Node ${i}: must be an object`);
        continue;
      }
      const n = node as Record<string, unknown>;
      if (typeof n.id !== 'string') errors.push(`Node ${i}: missing id`);
      if (typeof n.x !== 'number') errors.push(`Node ${i}: x must be number`);
      if (typeof n.y !== 'number') errors.push(`Node ${i}: y must be number`);
      if (typeof n.width !== 'number') errors.push(`Node ${i}: width must be number`);
      if (typeof n.height !== 'number') errors.push(`Node ${i}: height must be number`);
      if (!['text', 'file', 'link', 'group'].includes(n.type as string)) {
        errors.push(`Node ${i}: invalid type "${n.type}"`);
      }
    }
  }

  // Collect node IDs for uniqueness check and edge reference validation
  const nodeIds = new Set<string>();
  if (Array.isArray(canvas.nodes)) {
    for (const [i, node] of canvas.nodes.entries()) {
      if (node && typeof node === 'object') {
        const n = node as Record<string, unknown>;
        if (typeof n.id === 'string') {
          if (nodeIds.has(n.id)) {
            errors.push(`Node ${i}: duplicate node ID "${n.id}"`);
          }
          nodeIds.add(n.id);
        }
      }
    }
  }

  // Validate edges array
  if (!Array.isArray(canvas.edges)) {
    errors.push('Canvas must have an edges array');
  } else {
    for (const [i, edge] of canvas.edges.entries()) {
      if (!edge || typeof edge !== 'object') {
        errors.push(`Edge ${i}: must be an object`);
        continue;
      }
      const e = edge as Record<string, unknown>;
      if (typeof e.id !== 'string') errors.push(`Edge ${i}: missing id`);
      if (typeof e.fromNode !== 'string') {
        errors.push(`Edge ${i}: missing fromNode`);
      } else if (!nodeIds.has(e.fromNode)) {
        errors.push(`Edge ${i}: fromNode "${e.fromNode}" references non-existent node`);
      }
      if (typeof e.toNode !== 'string') {
        errors.push(`Edge ${i}: missing toNode`);
      } else if (!nodeIds.has(e.toNode)) {
        errors.push(`Edge ${i}: toNode "${e.toNode}" references non-existent node`);
      }
    }
  }

  return errors;
}

/**
 * Service for working with Obsidian Canvas files.
 */
export class CanvasService {
  private app: App;
  private idCounter = 0;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Generate a unique ID for canvas elements.
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (this.idCounter++).toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}${counter}${random}`;
  }

  /**
   * Create an empty canvas data structure.
   */
  createEmptyCanvas(): CanvasData {
    return {
      nodes: [],
      edges: [],
    };
  }

  /**
   * Read and parse a canvas file.
   */
  async readCanvas(filePath: string): Promise<CanvasData | null> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof Object && 'extension' in file)) {
      return null;
    }

    const tfile = file as TFile;
    if (tfile.extension !== 'canvas') {
      return null;
    }

    try {
      const content = await this.app.vault.read(tfile);
      const data = JSON.parse(content) as CanvasData;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Write canvas data to a file.
   * Validates data before writing.
   */
  async writeCanvas(filePath: string, canvas: CanvasData): Promise<boolean> {
    // Validate before writing
    const errors = validateCanvasData(canvas);
    if (errors.length > 0) {
      console.warn('Canvas validation failed:', errors);
      return false;
    }

    try {
      // Ensure .canvas extension
      const normalizedPath = filePath.endsWith('.canvas') ? filePath : `${filePath}.canvas`;

      const content = JSON.stringify(canvas, null, 2);
      const existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);

      if (existingFile && 'extension' in existingFile) {
        await this.app.vault.modify(existingFile as TFile, content);
      } else {
        await this.app.vault.create(normalizedPath, content);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a text node.
   */
  createTextNode(options: CreateTextNodeOptions): CanvasTextData {
    return {
      id: this.generateId(),
      type: 'text',
      text: options.text,
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? CANVAS_DEFAULTS.nodeWidth,
      height: options.height ?? CANVAS_DEFAULTS.nodeHeight,
      ...(options.color && { color: options.color }),
    };
  }

  /**
   * Create a file node that embeds a vault file.
   */
  createFileNode(options: CreateFileNodeOptions): CanvasFileData {
    return {
      id: this.generateId(),
      type: 'file',
      file: options.file,
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? CANVAS_DEFAULTS.nodeWidth,
      height: options.height ?? CANVAS_DEFAULTS.nodeHeight,
      ...(options.subpath && { subpath: options.subpath }),
      ...(options.color && { color: options.color }),
    };
  }

  /**
   * Create a link node for external URLs.
   */
  createLinkNode(options: CreateLinkNodeOptions): CanvasLinkData {
    return {
      id: this.generateId(),
      type: 'link',
      url: options.url,
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? CANVAS_DEFAULTS.nodeWidth,
      height: options.height ?? CANVAS_DEFAULTS.nodeHeight,
      ...(options.color && { color: options.color }),
    };
  }

  /**
   * Create a group node for visual grouping.
   */
  createGroupNode(options: CreateGroupNodeOptions): CanvasGroupData {
    return {
      id: this.generateId(),
      type: 'group',
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? CANVAS_DEFAULTS.nodeWidth * 2,
      height: options.height ?? CANVAS_DEFAULTS.nodeHeight * 2,
      ...(options.label && { label: options.label }),
      ...(options.color && { color: options.color }),
      ...(options.background && { background: options.background }),
      ...(options.backgroundStyle && { backgroundStyle: options.backgroundStyle }),
    };
  }

  /**
   * Create an edge connecting two nodes.
   */
  createEdge(options: CreateEdgeOptions): CanvasEdgeData {
    return {
      id: this.generateId(),
      fromNode: options.fromNode,
      fromSide: options.fromSide ?? 'right',
      toNode: options.toNode,
      toSide: options.toSide ?? 'left',
      ...(options.label && { label: options.label }),
      ...(options.color && { color: options.color }),
    };
  }

  /**
   * Add a node to a canvas.
   */
  addNode(canvas: CanvasData, node: AllCanvasNodeData): CanvasData {
    return {
      ...canvas,
      nodes: [...canvas.nodes, node],
    };
  }

  /**
   * Add an edge to a canvas.
   */
  addEdge(canvas: CanvasData, edge: CanvasEdgeData): CanvasData {
    return {
      ...canvas,
      edges: [...canvas.edges, edge],
    };
  }

  /**
   * Remove a node and its connected edges from a canvas.
   */
  removeNode(canvas: CanvasData, nodeId: string): CanvasData {
    return {
      nodes: canvas.nodes.filter((n) => n.id !== nodeId),
      edges: canvas.edges.filter((e) => e.fromNode !== nodeId && e.toNode !== nodeId),
    };
  }

  /**
   * Remove an edge from a canvas.
   */
  removeEdge(canvas: CanvasData, edgeId: string): CanvasData {
    return {
      ...canvas,
      edges: canvas.edges.filter((e) => e.id !== edgeId),
    };
  }

  /**
   * Find a node by ID.
   */
  findNode(canvas: CanvasData, nodeId: string): AllCanvasNodeData | undefined {
    return canvas.nodes.find((n) => n.id === nodeId);
  }

  /**
   * Find all edges connected to a node.
   */
  findConnectedEdges(canvas: CanvasData, nodeId: string): CanvasEdgeData[] {
    return canvas.edges.filter((e) => e.fromNode === nodeId || e.toNode === nodeId);
  }

  /**
   * Auto-layout nodes in a grid pattern.
   */
  autoLayoutGrid(canvas: CanvasData, options?: AutoLayoutOptions): CanvasData {
    const startX = options?.startX ?? 0;
    const startY = options?.startY ?? 0;
    const columns = options?.columns ?? 3;
    const nodeWidth = options?.nodeWidth ?? CANVAS_DEFAULTS.nodeWidth;
    const nodeHeight = options?.nodeHeight ?? CANVAS_DEFAULTS.nodeHeight;
    const spacing = options?.spacing ?? CANVAS_DEFAULTS.spacing;

    const layoutNodes = canvas.nodes.map((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      return {
        ...node,
        x: startX + col * (nodeWidth + spacing),
        y: startY + row * (nodeHeight + spacing),
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    return {
      ...canvas,
      nodes: layoutNodes,
    };
  }

  /**
   * Create a canvas from a list of vault files with connections based on links.
   */
  async createFromFiles(filePaths: string[], options?: AutoLayoutOptions): Promise<CanvasData> {
    let canvas = this.createEmptyCanvas();

    // Create file nodes
    const nodeMap = new Map<string, string>();
    for (const filePath of filePaths) {
      const node = this.createFileNode({ file: filePath });
      canvas = this.addNode(canvas, node);
      nodeMap.set(filePath, node.id);
    }

    // Auto-layout
    canvas = this.autoLayoutGrid(canvas, options);

    // Create edges based on resolved links
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      const sourceNodeId = nodeMap.get(sourcePath);
      if (!sourceNodeId) continue;

      for (const targetPath of Object.keys(links)) {
        const targetNodeId = nodeMap.get(targetPath);
        if (!targetNodeId) continue;

        const edge = this.createEdge({
          fromNode: sourceNodeId,
          toNode: targetNodeId,
        });
        canvas = this.addEdge(canvas, edge);
      }
    }

    return canvas;
  }

  /**
   * Create a canvas visualizing backlinks for a file.
   */
  async createBacklinksCanvas(filePath: string): Promise<CanvasData> {
    let canvas = this.createEmptyCanvas();

    // Center node for the target file
    const centerNode = this.createFileNode({
      file: filePath,
      x: 400,
      y: 300,
      color: '4', // Green
    });
    canvas = this.addNode(canvas, centerNode);

    // Get backlinks from metadataCache
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    const backlinks: string[] = [];

    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      if (links[filePath]) {
        backlinks.push(sourcePath);
      }
    }

    // Arrange backlinks in a circle around center
    const radius = 300;
    const angleStep = (2 * Math.PI) / Math.max(backlinks.length, 1);

    for (let i = 0; i < backlinks.length; i++) {
      const angle = i * angleStep - Math.PI / 2; // Start from top
      const x = 400 + radius * Math.cos(angle) - CANVAS_DEFAULTS.nodeWidth / 2;
      const y = 300 + radius * Math.sin(angle) - CANVAS_DEFAULTS.nodeHeight / 2;

      const node = this.createFileNode({
        file: backlinks[i],
        x,
        y,
      });
      canvas = this.addNode(canvas, node);

      // Edge pointing to center
      const edge = this.createEdge({
        fromNode: node.id,
        toNode: centerNode.id,
        toSide: 'top',
      });
      canvas = this.addEdge(canvas, edge);
    }

    return canvas;
  }
}
