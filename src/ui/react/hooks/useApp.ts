/**
 * Hook to access Obsidian App and modules from React context
 *
 * This follows the official Obsidian docs pattern for accessing the App
 * instance in React components. Also provides Component and MarkdownRenderer
 * to avoid dynamic imports which fail at runtime.
 *
 * @see https://docs.obsidian.md/Plugins/Getting+started/Use+React+in+your+plugin
 */

import { useContext } from 'react';
import { AppContext, type AppContextValue } from '../context/AppContext';

/**
 * Access the Obsidian App instance and modules from React components.
 *
 * @returns The AppContextValue with app, Component, and MarkdownRenderer,
 *          or undefined if not in AppContext
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const ctx = useApp();
 *   if (!ctx) return null;
 *
 *   const { app, Component, MarkdownRenderer } = ctx;
 *   // Use app.vault, app.workspace, Component, MarkdownRenderer, etc.
 *   return <div>{app.vault.getName()}</div>;
 * };
 * ```
 */
export const useApp = (): AppContextValue | undefined => {
  return useContext(AppContext);
};
