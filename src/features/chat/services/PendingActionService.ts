/**
 * PendingActionService manages pending actions that need auto-fixing.
 *
 * Provides a generic system for tracking and retrying failed operations
 * like mermaid diagram rendering, code corrections, etc.
 */

import type { ChatState } from '../state/ChatState';
import type { PendingAction, PendingActionStatus, PendingActionType } from '../state/types';

/** Parameters for creating a new pending action. */
export interface CreatePendingActionParams {
  /** Unique ID for the action (e.g., mermaid-abc123). */
  id: string;
  /** Type of action. */
  type: PendingActionType;
  /** Optional DOM element reference for in-place updates. */
  elementRef?: HTMLElement;
  /** Type-specific metadata. */
  metadata: Record<string, unknown>;
  /** Maximum attempts before giving up (default: 2). */
  maxAttempts?: number;
}

/**
 * Service for managing pending actions that need auto-fixing.
 */
export class PendingActionService {
  constructor(private state: ChatState) {}

  /**
   * Creates a new pending action.
   * @param params - Action parameters.
   * @returns The created action.
   */
  create(params: CreatePendingActionParams): PendingAction {
    const action: PendingAction = {
      id: params.id,
      type: params.type,
      status: 'pending',
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 2,
      elementRef: params.elementRef,
      metadata: params.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.state.pendingActions.set(params.id, action);
    return action;
  }

  /**
   * Gets a pending action by ID.
   * @param id - Action ID.
   * @returns The action or undefined if not found.
   */
  get(id: string): PendingAction | undefined {
    return this.state.pendingActions.get(id);
  }

  /**
   * Marks an action as fixing (Claude is working on it).
   * Increments the attempt counter.
   * @param id - Action ID.
   */
  markFixing(id: string): void {
    const action = this.state.pendingActions.get(id);
    if (action) {
      action.status = 'fixing';
      action.attempts++;
      action.updatedAt = Date.now();
    }
  }

  /**
   * Marks an action as completed (successfully fixed).
   * @param id - Action ID.
   */
  markCompleted(id: string): void {
    const action = this.state.pendingActions.get(id);
    if (action) {
      action.status = 'completed';
      action.updatedAt = Date.now();
    }
  }

  /**
   * Marks an action as failed.
   * If under max retries, status becomes 'pending' for retry.
   * If at max retries, status becomes 'failed'.
   * @param id - Action ID.
   * @param error - Error message.
   */
  markFailed(id: string, error: string): void {
    const action = this.state.pendingActions.get(id);
    if (action) {
      action.error = error;
      // Check if max retries reached
      if (action.attempts >= action.maxAttempts) {
        action.status = 'failed'; // Give up
      } else {
        action.status = 'pending'; // Will retry
      }
      action.updatedAt = Date.now();
    }
  }

  /**
   * Gets all actions needing fix (pending, not at max retries).
   * @param type - Optional filter by action type.
   * @returns Array of pending actions.
   */
  getActionsPendingFix(type?: PendingActionType): PendingAction[] {
    return Array.from(this.state.pendingActions.values()).filter(
      (a) => a.status === 'pending' && (!type || a.type === type),
    );
  }

  /**
   * Gets all actions currently being fixed.
   * @param type - Optional filter by action type.
   * @returns Array of fixing actions.
   */
  getFixingActions(type?: PendingActionType): PendingAction[] {
    return Array.from(this.state.pendingActions.values()).filter(
      (a) => a.status === 'fixing' && (!type || a.type === type),
    );
  }

  /**
   * Checks if any actions are currently being fixed.
   * @param type - Optional filter by action type.
   * @returns True if any actions are being fixed.
   */
  hasFixingActions(type?: PendingActionType): boolean {
    return Array.from(this.state.pendingActions.values()).some(
      (a) => a.status === 'fixing' && (!type || a.type === type),
    );
  }

  /**
   * Checks if any actions are pending (waiting to be fixed).
   * @param type - Optional filter by action type.
   * @returns True if any actions are pending.
   */
  hasPendingActions(type?: PendingActionType): boolean {
    return Array.from(this.state.pendingActions.values()).some(
      (a) => a.status === 'pending' && (!type || a.type === type),
    );
  }

  /**
   * Gets all actions by status.
   * @param status - Status to filter by.
   * @param type - Optional filter by action type.
   * @returns Array of actions.
   */
  getActionsByStatus(status: PendingActionStatus, type?: PendingActionType): PendingAction[] {
    return Array.from(this.state.pendingActions.values()).filter(
      (a) => a.status === status && (!type || a.type === type),
    );
  }

  /**
   * Removes an action from the map.
   * @param id - Action ID.
   */
  remove(id: string): void {
    this.state.pendingActions.delete(id);
  }

  /**
   * Clears completed and failed actions from the map.
   */
  cleanup(): void {
    for (const [id, action] of this.state.pendingActions) {
      if (action.status === 'completed' || action.status === 'failed') {
        this.state.pendingActions.delete(id);
      }
    }
  }

  /**
   * Clears all actions from the map.
   */
  clear(): void {
    this.state.pendingActions.clear();
  }
}
