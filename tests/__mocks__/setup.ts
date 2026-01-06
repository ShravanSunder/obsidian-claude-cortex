// Vitest setup file
import { vi } from 'vitest';

// Mock obsidian module
vi.mock('obsidian', () => import('./obsidian'));

// Mock claude-agent-sdk module
vi.mock('@anthropic-ai/claude-agent-sdk', () => import('./claude-agent-sdk'));
