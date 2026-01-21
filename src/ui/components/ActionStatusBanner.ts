/**
 * ActionStatusBanner - Generic UI component for showing action status on elements.
 *
 * Shows status banners for pending actions like mermaid fixes,
 * including progress indicators and failure messages.
 */

import type { PendingAction } from '../../features/chat/state/types';

const BANNER_CLASS = 'cortex-action-status';

/**
 * Shows or updates an action status banner on an element.
 * @param element - The element to show the banner on.
 * @param action - The pending action with status info.
 */
export function showActionStatus(element: HTMLElement, action: PendingAction): void {
  // Get or create banner
  let banner = element.querySelector(`.${BANNER_CLASS}`) as HTMLElement | null;
  if (!banner) {
    banner = document.createElement('div');
    banner.className = BANNER_CLASS;
    element.insertBefore(banner, element.firstChild);
  }

  // Clear existing content
  banner.empty();

  switch (action.status) {
    case 'pending':
      // Show waiting state if already attempted
      if (action.attempts > 0) {
        banner.innerHTML = `<span class="cortex-action-status-icon">⟳</span> Retrying... (attempt ${action.attempts + 1}/${action.maxAttempts})`;
        banner.classList.remove('cortex-action-status-error');
        banner.classList.add('cortex-action-status-pending');
      } else {
        // Remove banner if not yet attempted
        banner.remove();
      }
      break;

    case 'fixing':
      banner.innerHTML = `<span class="cortex-action-status-spinner"></span> Fixing... (attempt ${action.attempts}/${action.maxAttempts})`;
      banner.classList.remove('cortex-action-status-error');
      banner.classList.add('cortex-action-status-fixing');
      break;

    case 'failed':
      banner.innerHTML = `<span class="cortex-action-status-icon cortex-action-status-error-icon">✗</span> Fix failed after ${action.attempts} attempts`;
      banner.classList.add('cortex-action-status-error');
      banner.classList.remove('cortex-action-status-fixing', 'cortex-action-status-pending');
      break;

    case 'completed':
      // Remove banner on success
      banner.remove();
      break;
  }
}

/**
 * Hides the action status banner from an element.
 * @param element - The element to remove the banner from.
 */
export function hideActionStatus(element: HTMLElement): void {
  const banner = element.querySelector(`.${BANNER_CLASS}`);
  if (banner) {
    banner.remove();
  }
}

/**
 * Shows a "fixing" state banner on an element.
 * @param element - The element to show the banner on.
 * @param attempt - Current attempt number.
 * @param maxAttempts - Maximum attempts allowed.
 */
export function showFixingStatus(element: HTMLElement, attempt: number, maxAttempts: number): void {
  let banner = element.querySelector(`.${BANNER_CLASS}`) as HTMLElement | null;
  if (!banner) {
    banner = document.createElement('div');
    banner.className = BANNER_CLASS;
    element.insertBefore(banner, element.firstChild);
  }

  banner.innerHTML = `<span class="cortex-action-status-spinner"></span> Fixing... (attempt ${attempt}/${maxAttempts})`;
  banner.classList.remove('cortex-action-status-error');
  banner.classList.add('cortex-action-status-fixing');
}

/**
 * Shows a "failed" state banner on an element.
 * @param element - The element to show the banner on.
 * @param attempts - Number of attempts made.
 * @param error - Optional error message.
 */
export function showFailedStatus(element: HTMLElement, attempts: number, error?: string): void {
  let banner = element.querySelector(`.${BANNER_CLASS}`) as HTMLElement | null;
  if (!banner) {
    banner = document.createElement('div');
    banner.className = BANNER_CLASS;
    element.insertBefore(banner, element.firstChild);
  }

  let message = `<span class="cortex-action-status-icon cortex-action-status-error-icon">✗</span> Fix failed after ${attempts} attempts`;
  if (error) {
    message += `<span class="cortex-action-status-error-detail" title="${escapeHtml(error)}">: ${truncateError(error)}</span>`;
  }
  banner.innerHTML = message;
  banner.classList.add('cortex-action-status-error');
  banner.classList.remove('cortex-action-status-fixing', 'cortex-action-status-pending');
}

/**
 * Escapes HTML special characters in a string.
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncates an error message to a reasonable length.
 */
function truncateError(error: string): string {
  const maxLength = 50;
  if (error.length <= maxLength) {
    return error;
  }
  return error.slice(0, maxLength) + '...';
}
