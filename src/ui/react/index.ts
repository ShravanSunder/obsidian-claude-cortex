/**
 * React rendering system for Cortex
 *
 * This module provides the React-based UI components for the chat interface.
 * It exports everything needed to mount React within an Obsidian ItemView.
 */

// Components
export { ChatContainer, type ChatContainerProps } from './components/ChatContainer';
// Context
export { AppContext } from './context/AppContext';
// Hooks
export { useApp } from './hooks/useApp';
