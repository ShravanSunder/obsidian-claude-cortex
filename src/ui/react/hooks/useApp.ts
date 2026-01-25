/**
 * Hook to access Obsidian App from React context
 *
 * This follows the official Obsidian docs pattern for accessing the App
 * instance in React components.
 *
 * @see https://docs.obsidian.md/Plugins/Getting+started/Use+React+in+your+plugin
 */

import { useContext } from 'react';
import { AppContext } from '../context/AppContext';

/**
 * Access the Obsidian App instance from React components.
 *
 * @returns The Obsidian App instance, or undefined if not in AppContext
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const app = useApp();
 *   if (!app) return null;
 *
 *   // Use app.vault, app.workspace, etc.
 *   return <div>{app.vault.getName()}</div>;
 * };
 * ```
 */
export const useApp = () => {
  return useContext(AppContext);
};
