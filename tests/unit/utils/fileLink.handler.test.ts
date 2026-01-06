import { registerFileLinkHandler } from '@/utils/fileLink';

describe('registerFileLinkHandler', () => {
  it('opens data-href target when present', () => {
    const app = {
      workspace: {
        openLinkText: vi.fn(),
      },
    };

    const link: any = {
      dataset: { href: 'note#section' },
      getAttribute: vi.fn().mockReturnValue('note'),
      closest: vi.fn(),
    };
    link.closest.mockReturnValue(link);

    const event = {
      target: link,
      preventDefault: vi.fn(),
    } as any;

    const component = {
      registerDomEvent: (_el: HTMLElement, _event: string, cb: (event: MouseEvent) => void) => {
        cb(event);
      },
    };

    registerFileLinkHandler(app as any, {} as HTMLElement, component as any);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('note#section', '', 'tab');
  });

  it('falls back to href when data-href is missing', () => {
    const app = {
      workspace: {
        openLinkText: vi.fn(),
      },
    };

    const link: any = {
      dataset: {},
      getAttribute: vi.fn().mockReturnValue('note^block'),
      closest: vi.fn(),
    };
    link.closest.mockReturnValue(link);

    const event = {
      target: link,
      preventDefault: vi.fn(),
    } as any;

    const component = {
      registerDomEvent: (_el: HTMLElement, _event: string, cb: (event: MouseEvent) => void) => {
        cb(event);
      },
    };

    registerFileLinkHandler(app as any, {} as HTMLElement, component as any);

    expect(app.workspace.openLinkText).toHaveBeenCalledWith('note^block', '', 'tab');
  });
});
