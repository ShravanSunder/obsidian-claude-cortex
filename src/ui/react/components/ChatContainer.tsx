/**
 * Root chat container component
 *
 * This is the main React component that will eventually contain the full
 * chat interface. Currently empty - content will be added in Phase 3+.
 */

export interface ChatContainerProps {
  /** Optional class name for additional styling */
  className?: string;
}

/**
 * Root container for the React-based chat UI.
 * Will be populated with message components in later phases.
 */
export const ChatContainer = ({ className }: ChatContainerProps) => {
  return <div className={`cortex-react-root ${className ?? ''}`} />;
};
