/**
 * Loading skeleton placeholder for blocks
 *
 * Displays an animated placeholder while content is loading or rendering.
 * Used for mermaid diagrams and other heavy content.
 */

export interface BlockSkeletonProps {
  /** Type of block being loaded */
  type?: 'code' | 'mermaid' | 'prose';
  /** Optional label to display */
  label?: string;
  /** Height hint for the skeleton */
  height?: number | string;
}

/**
 * Animated loading skeleton for block content
 */
export const BlockSkeleton = ({ type = 'code', label, height = 100 }: BlockSkeletonProps) => {
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`cortex-block-skeleton cortex-block-skeleton-${type}`}
      style={{ minHeight: heightStyle }}
    >
      <div className="cortex-block-skeleton-shimmer" />
      {label && <span className="cortex-block-skeleton-label">{label}</span>}
    </div>
  );
};
