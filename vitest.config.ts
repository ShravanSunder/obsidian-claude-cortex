import path from 'path';
import { defineConfig } from 'vitest/config';

// Shared aliases for all projects (with mocked SDK)
const mockedAliases = {
  '@': path.resolve(__dirname, './src'),
  '@test': path.resolve(__dirname, './tests'),
  obsidian: path.resolve(__dirname, './tests/__mocks__/obsidian.ts'),
  '@anthropic-ai/claude-agent-sdk': path.resolve(
    __dirname,
    './tests/__mocks__/claude-agent-sdk.ts',
  ),
};

// Aliases without SDK mock (for real SDK tests)
const realSdkAliases = {
  '@': path.resolve(__dirname, './src'),
  '@test': path.resolve(__dirname, './tests'),
};

export default defineConfig({
  test: {
    projects: [
      {
        // Unit tests - mocked SDK
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          setupFiles: ['./tests/__mocks__/setup.ts'],
          include: ['tests/unit/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
        },
        resolve: {
          alias: mockedAliases,
        },
      },
      {
        // Integration tests - mocked SDK
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          setupFiles: ['./tests/__mocks__/setup.ts'],
          include: ['tests/integration/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'tests/integration/core/agent/session-isolation.test.ts'],
        },
        resolve: {
          alias: mockedAliases,
        },
      },
      {
        // Real SDK tests - NO mocks, calls actual Claude Code CLI
        // Run with: CORTEX_SDK_TESTS=1 pnpm test --project=sdk
        test: {
          name: 'sdk',
          globals: true,
          environment: 'node',
          // No setupFiles - don't load mocks
          include: ['tests/integration/core/agent/session-isolation.test.ts'],
          exclude: ['**/node_modules/**'],
          testTimeout: 300000, // 5 minute timeout for real API calls
        },
        resolve: {
          alias: realSdkAliases,
        },
      },
    ],
  },
});
