/**
 * Chat input component
 *
 * Text input area with support for file/image attachments,
 * slash commands, and @-mentions.
 */

import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

export interface ChatInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Initial value */
  value?: string;
  /** Submit handler */
  onSubmit?: (value: string) => void;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Key down handler (for special keys) */
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Handler for file drops/attachments */
  onAttach?: (files: File[]) => void;
  /** Optional class name */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

/**
 * Chat input with auto-resize and keyboard handling
 */
export const ChatInput = ({
  placeholder = 'Type a message...',
  disabled = false,
  value: controlledValue,
  onSubmit,
  onChange,
  onKeyDown,
  onAttach,
  className,
  autoFocus = false,
}: ChatInputProps) => {
  const [internalValue, setInternalValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const value = controlledValue ?? internalValue;
  const isControlled = controlledValue !== undefined;

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
      adjustHeight();
    },
    [isControlled, onChange, adjustHeight],
  );

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit?.(value.trim());
        if (!isControlled) {
          setInternalValue('');
        }
        // Reset height after submit
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    },
    [value, disabled, onSubmit, isControlled],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      onKeyDown?.(e);
    },
    [handleSubmit, onKeyDown],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && onAttach) {
        onAttach(files);
      }
    },
    [onAttach],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  const classNames = ['cortex-chat-input', disabled && 'cortex-chat-input-disabled', className]
    .filter(Boolean)
    .join(' ');

  return (
    <form className={classNames} onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className="cortex-chat-input-textarea"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={1}
      />
      <button
        type="submit"
        className="cortex-chat-input-submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        ↵
      </button>
    </form>
  );
};
