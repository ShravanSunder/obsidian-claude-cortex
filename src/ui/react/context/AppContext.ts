/**
 * React context for Obsidian App instance and related modules
 *
 * This follows the official Obsidian docs pattern for providing the App
 * instance to React components via context. We also include Component and
 * MarkdownRenderer to avoid dynamic imports which fail at runtime when
 * 'obsidian' is marked as external in the bundle.
 *
 * @see https://docs.obsidian.md/Plugins/Getting+started/Use+React+in+your+plugin
 */

import type { App, Component, MarkdownRenderer } from 'obsidian';
import { createContext } from 'react';

/**
 * Context value providing Obsidian App and related modules.
 * Component and MarkdownRenderer are passed here instead of using
 * dynamic imports, which fail when 'obsidian' is external.
 */
export interface AppContextValue {
  app: App;
  Component: typeof Component;
  MarkdownRenderer: typeof MarkdownRenderer;
}

/**
 * React context that provides access to the Obsidian App instance and modules.
 * Use the useApp() hook to access this context in components.
 */
export const AppContext = createContext<AppContextValue | undefined>(undefined);
