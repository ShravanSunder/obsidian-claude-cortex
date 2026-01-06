/**
 * Tests for SelectionController - Selection Polling and Highlighting
 */

import { SelectionController } from '@/features/chat/controllers/SelectionController';
import { hideSelectionHighlight, showSelectionHighlight } from '@/ui';

vi.mock('@/ui', () => ({
  showSelectionHighlight: vi.fn(),
  hideSelectionHighlight: vi.fn(),
}));

function createMockIndicator() {
  return {
    textContent: '',
    style: { display: 'none' },
  } as any;
}

describe('SelectionController', () => {
  let controller: SelectionController;
  let app: any;
  let indicatorEl: any;
  let inputEl: any;
  let editor: any;
  let editorView: any;
  let originalDocument: any;

  beforeEach(() => {
    vi.useFakeTimers();
    (showSelectionHighlight as import('vitest').Mock).mockClear();
    (hideSelectionHighlight as import('vitest').Mock).mockClear();

    indicatorEl = createMockIndicator();
    inputEl = {};

    editorView = { id: 'editor-view' };
    editor = {
      getSelection: vi.fn().mockReturnValue('selected text'),
      getCursor: vi.fn((which: 'from' | 'to') => {
        if (which === 'from') return { line: 0, ch: 0 };
        return { line: 0, ch: 4 };
      }),
      posToOffset: vi.fn((pos: { line: number; ch: number }) => pos.line * 100 + pos.ch),
      cm: editorView,
    };

    const view = { editor, file: { path: 'notes/test.md' } };
    app = {
      workspace: {
        getActiveViewOfType: vi.fn().mockReturnValue(view),
      },
    };

    controller = new SelectionController(app, indicatorEl, inputEl);

    originalDocument = (global as any).document;
    (global as any).document = { activeElement: null };
  });

  afterEach(() => {
    controller.stop();
    vi.useRealTimers();
    (global as any).document = originalDocument;
  });

  it('captures selection and updates indicator', () => {
    controller.start();
    vi.advanceTimersByTime(250);

    expect(controller.hasSelection()).toBe(true);
    expect(controller.getContext()).toEqual({
      notePath: 'notes/test.md',
      mode: 'selection',
      selectedText: 'selected text',
      lineCount: 1,
      startLine: 1,
    });
    expect(indicatorEl.textContent).toBe('1 line selected');
    expect(indicatorEl.style.display).toBe('block');

    controller.showHighlight();
    expect(showSelectionHighlight).toHaveBeenCalledWith(editorView, 0, 4);
  });

  it('clears selection when selection is removed and input is not focused', () => {
    controller.start();
    vi.advanceTimersByTime(250);

    editor.getSelection.mockReturnValue('');
    (global as any).document.activeElement = null;

    vi.advanceTimersByTime(250);

    expect(controller.hasSelection()).toBe(false);
    expect(indicatorEl.style.display).toBe('none');
    expect(hideSelectionHighlight).toHaveBeenCalledWith(editorView);
  });
});
