/**
 * Mention dropdown component
 *
 * Displays available @-mentions (files, notes, etc.) in a dropdown
 * that appears when typing '@'.
 */

import { useCallback, useEffect, useState } from 'react';

export type MentionType = 'file' | 'note' | 'folder' | 'tag';

export interface MentionItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Type of mention */
  type: MentionType;
  /** Full path (for files/notes) */
  path?: string;
  /** Optional icon */
  icon?: string;
}

export interface MentionDropdownProps {
  /** Available mention items */
  items: MentionItem[];
  /** Current filter text (what user typed after @) */
  filter?: string;
  /** Whether dropdown is visible */
  visible?: boolean;
  /** Selected index for keyboard navigation */
  selectedIndex?: number;
  /** Handler when item is selected */
  onSelect?: (item: MentionItem) => void;
  /** Handler when dropdown should close */
  onClose?: () => void;
  /** Optional class name */
  className?: string;
  /** Maximum items to display */
  maxItems?: number;
}

/**
 * Get icon for mention type
 */
function getTypeIcon(type: MentionType): string {
  switch (type) {
    case 'file':
      return '📄';
    case 'note':
      return '📝';
    case 'folder':
      return '📁';
    case 'tag':
      return '#';
    default:
      return '•';
  }
}

/**
 * Dropdown menu for @-mentions
 */
export const MentionDropdown = ({
  items,
  filter = '',
  visible = false,
  selectedIndex = 0,
  onSelect,
  onClose,
  className,
  maxItems = 10,
}: MentionDropdownProps) => {
  const [internalIndex, setInternalIndex] = useState(selectedIndex);

  // Filter items based on input
  const filteredItems = items
    .filter(
      (item) =>
        item.name.toLowerCase().includes(filter.toLowerCase()) ||
        item.path?.toLowerCase().includes(filter.toLowerCase()),
    )
    .slice(0, maxItems);

  // Reset index when filter changes
  useEffect(() => {
    setInternalIndex(0);
  }, [filter]);

  // Sync with external index
  useEffect(() => {
    setInternalIndex(selectedIndex);
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (item: MentionItem) => {
      onSelect?.(item);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setInternalIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setInternalIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredItems[internalIndex]) {
            handleSelect(filteredItems[internalIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
      }
    },
    [visible, filteredItems, internalIndex, handleSelect, onClose],
  );

  // Add keyboard listener
  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  if (!visible || filteredItems.length === 0) {
    return null;
  }

  const classNames = ['cortex-mention-dropdown', className].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="cortex-mention-dropdown-list">
        {filteredItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`cortex-mention-dropdown-item ${index === internalIndex ? 'cortex-mention-dropdown-item-selected' : ''}`}
            onClick={() => handleSelect(item)}
            onMouseEnter={() => setInternalIndex(index)}
          >
            <span className="cortex-mention-dropdown-icon">
              {item.icon || getTypeIcon(item.type)}
            </span>
            <span className="cortex-mention-dropdown-name">{item.name}</span>
            {item.path && item.path !== item.name && (
              <span className="cortex-mention-dropdown-path">{item.path}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
