/**
 * Chat toolbar component
 *
 * Container for toolbar items like model selector,
 * thinking toggle, and other controls.
 */

import type { ReactNode } from 'react';

export interface ToolbarProps {
  /** Toolbar items */
  children: ReactNode;
  /** Optional class name */
  className?: string;
}

/**
 * Toolbar container component
 */
export const Toolbar = ({ children, className }: ToolbarProps) => {
  const classNames = ['cortex-toolbar', className].filter(Boolean).join(' ');

  return <div className={classNames}>{children}</div>;
};

/**
 * Individual toolbar item props
 */
export interface ToolbarItemProps {
  /** Item content */
  children: ReactNode;
  /** Whether the item is active/selected */
  active?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Optional class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Tooltip/title */
  title?: string;
}

/**
 * Individual toolbar item/button
 */
export const ToolbarItem = ({
  children,
  active = false,
  onClick,
  className,
  disabled = false,
  title,
}: ToolbarItemProps) => {
  const classNames = [
    'cortex-toolbar-item',
    active && 'cortex-toolbar-item-active',
    disabled && 'cortex-toolbar-item-disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classNames}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
};

/**
 * Toolbar separator
 */
export const ToolbarSeparator = () => {
  return <div className="cortex-toolbar-separator" />;
};
