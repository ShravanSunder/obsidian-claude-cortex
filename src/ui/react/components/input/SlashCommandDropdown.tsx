/**
 * Slash command dropdown component
 *
 * Displays available slash commands in a dropdown menu
 * that appears when typing '/'.
 */

import { useCallback, useEffect, useState } from 'react';

export interface SlashCommand {
  /** Command name (without /) */
  name: string;
  /** Command description */
  description: string;
  /** Optional icon */
  icon?: string;
}

export interface SlashCommandDropdownProps {
  /** Available commands */
  commands: SlashCommand[];
  /** Current filter text (what user typed after /) */
  filter?: string;
  /** Whether dropdown is visible */
  visible?: boolean;
  /** Selected index for keyboard navigation */
  selectedIndex?: number;
  /** Handler when command is selected */
  onSelect?: (command: SlashCommand) => void;
  /** Handler when dropdown should close */
  onClose?: () => void;
  /** Optional class name */
  className?: string;
}

/**
 * Dropdown menu for slash commands
 */
export const SlashCommandDropdown = ({
  commands,
  filter = '',
  visible = false,
  selectedIndex = 0,
  onSelect,
  onClose,
  className,
}: SlashCommandDropdownProps) => {
  const [internalIndex, setInternalIndex] = useState(selectedIndex);

  // Filter commands based on input
  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(filter.toLowerCase()),
  );

  // Reset index when filter changes
  useEffect(() => {
    setInternalIndex(0);
  }, [filter]);

  // Sync with external index
  useEffect(() => {
    setInternalIndex(selectedIndex);
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (command: SlashCommand) => {
      onSelect?.(command);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setInternalIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setInternalIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[internalIndex]) {
            handleSelect(filteredCommands[internalIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
      }
    },
    [visible, filteredCommands, internalIndex, handleSelect, onClose],
  );

  // Add keyboard listener
  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  if (!visible || filteredCommands.length === 0) {
    return null;
  }

  const classNames = ['cortex-slash-dropdown', className].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="cortex-slash-dropdown-list">
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.name}
            type="button"
            className={`cortex-slash-dropdown-item ${index === internalIndex ? 'cortex-slash-dropdown-item-selected' : ''}`}
            onClick={() => handleSelect(cmd)}
            onMouseEnter={() => setInternalIndex(index)}
          >
            {cmd.icon && <span className="cortex-slash-dropdown-icon">{cmd.icon}</span>}
            <span className="cortex-slash-dropdown-name">/{cmd.name}</span>
            <span className="cortex-slash-dropdown-description">{cmd.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
