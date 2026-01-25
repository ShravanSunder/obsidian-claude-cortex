/**
 * React rendering system for Cortex
 *
 * This module provides the React-based UI components for the chat interface.
 * It exports everything needed to mount React within an Obsidian ItemView.
 */

export {
  BlockRenderer,
  type BlockRendererProps,
  BlockSkeleton,
  type BlockSkeletonProps,
  CodeBlock,
  type CodeBlockProps,
  MermaidBlock,
  type MermaidBlockProps,
  ProseBlock,
  type ProseBlockProps,
} from './components/blocks';
// Components
export { ChatContainer, type ChatContainerProps } from './components/ChatContainer';
export {
  ChatInput,
  type ChatInputProps,
  MentionDropdown,
  type MentionDropdownProps,
  type MentionItem,
  type MentionType,
  type SlashCommand,
  SlashCommandDropdown,
  type SlashCommandDropdownProps,
  Toolbar,
  ToolbarItem,
  type ToolbarItemProps,
  type ToolbarProps,
  ToolbarSeparator,
} from './components/input';
export { Message, type MessageProps, type MessageRole } from './components/Message';
export { MessageList, type MessageListProps } from './components/MessageList';
export {
  StreamingMessage,
  type StreamingMessageHandle,
  type StreamingMessageProps,
  type StreamingMessageRef,
} from './components/StreamingMessage';
export { ThinkingBlock, type ThinkingBlockProps } from './components/thinking';
export {
  SubagentBlock,
  type SubagentBlockProps,
  type SubagentStatus,
  type SubagentToolCall,
  ToolCallBlock,
  type ToolCallBlockProps,
  type ToolStatus,
} from './components/tools';
// Context
export { AppContext } from './context/AppContext';
// Hooks
export { useApp } from './hooks/useApp';
export { type UseObsidianRenderResult, useObsidianRender } from './hooks/useObsidianRender';
export { type UseStreamingParserResult, useStreamingParser } from './hooks/useStreamingParser';
// Parser
export {
  type Block,
  type BlockCompleteEvent,
  type BlockDeltaEvent,
  type BlockEvent,
  type BlockEventType,
  type BlockStartEvent,
  type BlockState,
  type BlockType,
  djb2Hash,
  generateBlockId,
  type ParserOptions,
  type ParserState,
  StreamingMarkdownParser,
} from './parser';
// Utils
export {
  extractTextFromChunk,
  getActiveFilePath,
  getFolders,
  getMarkdownFiles,
  getVaultName,
  getVaultPath,
  isAppAvailable,
  openFile,
  readFile,
  type StreamChunk,
} from './utils';
