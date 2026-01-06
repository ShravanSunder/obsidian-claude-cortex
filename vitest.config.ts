import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/__mocks__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './tests'),
      obsidian: path.resolve(__dirname, './tests/__mocks__/obsidian.ts'),
      '@anthropic-ai/claude-agent-sdk': path.resolve(
        __dirname,
        './tests/__mocks__/claude-agent-sdk.ts',
      ),
    },
  },
});
