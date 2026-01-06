// Mock for Obsidian API
import { vi } from 'vitest';

export class Plugin {
  app: any;
  manifest: any;

  constructor(app?: any, manifest?: any) {
    this.app = app;
    this.manifest = manifest;
  }

  addRibbonIcon = vi.fn();
  addCommand = vi.fn();
  addSettingTab = vi.fn();
  registerView = vi.fn();
  loadData = vi.fn().mockResolvedValue({});
  saveData = vi.fn().mockResolvedValue(undefined);
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any = {
    empty: vi.fn(),
    createEl: vi.fn().mockReturnValue({ createEl: vi.fn(), createDiv: vi.fn() }),
    createDiv: vi.fn().mockReturnValue({ createEl: vi.fn(), createDiv: vi.fn() }),
  };

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  display() {}
}

export class ItemView {
  app: any;
  leaf: any;
  containerEl: any = {
    children: [
      {},
      {
        empty: vi.fn(),
        addClass: vi.fn(),
        createDiv: vi.fn().mockReturnValue({
          createEl: vi.fn().mockReturnValue({ addEventListener: vi.fn(), setAttribute: vi.fn() }),
          createDiv: vi
            .fn()
            .mockReturnValue({ createEl: vi.fn().mockReturnValue({ addEventListener: vi.fn() }) }),
        }),
      },
    ],
  };

  constructor(leaf: any) {
    this.leaf = leaf;
  }

  getViewType(): string {
    return '';
  }

  getDisplayText(): string {
    return '';
  }

  getIcon(): string {
    return '';
  }
}

export class WorkspaceLeaf {}

export class App {
  vault: any = {
    adapter: {
      basePath: '/mock/vault/path',
    },
  };
  workspace: any = {
    getLeavesOfType: vi.fn().mockReturnValue([]),
    getRightLeaf: vi.fn().mockReturnValue({
      setViewState: vi.fn().mockResolvedValue(undefined),
    }),
    revealLeaf: vi.fn(),
  };
}

export class MarkdownView {
  editor: any;
  file?: any;

  constructor(editor?: any, file?: any) {
    this.editor = editor;
    this.file = file;
  }
}

export class Setting {
  constructor(_containerEl: unknown) {}
  setName = vi.fn().mockReturnThis();
  setDesc = vi.fn().mockReturnThis();
  addToggle = vi.fn().mockReturnThis();
  addTextArea = vi.fn().mockReturnThis();
}

export class Modal {
  app: any;
  containerEl: any = {
    createDiv: vi.fn().mockReturnValue({
      createEl: vi.fn().mockReturnValue({ addEventListener: vi.fn() }),
      createDiv: vi.fn().mockReturnValue({
        createEl: vi.fn().mockReturnValue({ addEventListener: vi.fn() }),
        createDiv: vi.fn().mockReturnValue({
          createEl: vi.fn(),
        }),
        setText: vi.fn(),
      }),
      addClass: vi.fn(),
      setText: vi.fn(),
    }),
    empty: vi.fn(),
    addClass: vi.fn(),
  };
  contentEl: any = {
    createDiv: vi.fn().mockReturnValue({
      createEl: vi.fn().mockReturnValue({ addEventListener: vi.fn() }),
      createDiv: vi.fn().mockReturnValue({
        createEl: vi.fn().mockReturnValue({ addEventListener: vi.fn() }),
        createDiv: vi.fn().mockReturnValue({
          createEl: vi.fn(),
        }),
        setText: vi.fn(),
      }),
      addClass: vi.fn(),
      setText: vi.fn(),
    }),
    empty: vi.fn(),
    addClass: vi.fn(),
  };

  constructor(app: any) {
    this.app = app;
  }

  open = vi.fn();
  close = vi.fn();
  onOpen = vi.fn();
  onClose = vi.fn();
}

export const MarkdownRenderer = {
  renderMarkdown: vi.fn().mockResolvedValue(undefined),
};

export const setIcon = vi.fn();

export class Notice {
  constructor(_message: string) {}
}

// TFile class for instanceof checks
export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;

  constructor(path = '') {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.basename = this.name.replace(/\.[^.]+$/, '');
    this.extension = this.name.split('.').pop() || '';
  }
}
