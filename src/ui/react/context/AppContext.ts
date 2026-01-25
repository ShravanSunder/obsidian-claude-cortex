/**
 * React context for Obsidian App instance
 *
 * This follows the official Obsidian docs pattern for providing the App
 * instance to React components via context.
 *
 * @see https://docs.obsidian.md/Plugins/Getting+started/Use+React+in+your+plugin
 */

import type { App } from 'obsidian';
import { createContext } from 'react';

/**
 * React context that provides access to the Obsidian App instance.
 * Use the useApp() hook to access this context in components.
 */
export const AppContext = createContext<App | undefined>(undefined);
