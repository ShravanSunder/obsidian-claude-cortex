# CLAUDE.md

typescript rules:
@.cursor/rules/ts-rules.mdc

## Key Patterns

### Claude Agent SDK
```typescript
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';

const options: Options = {
  cwd: vaultPath,
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  model: settings.model,
  abortController: this.abortController,
  pathToClaudeCodeExecutable: '/path/to/claude',
  resume: sessionId,
  maxThinkingTokens: budgetConfig.tokens, // Optional extended thinking
};

const response = query({ prompt, options });
for await (const message of response) { /* Handle streaming */ }
```

### Obsidian Basics
```typescript
// View registration
this.registerView(VIEW_TYPE_CLAUDIAN, (leaf) => new CortexView(leaf, this));

// Vault path
const vaultPath = this.app.vault.adapter.basePath;

// Markdown rendering
await MarkdownRenderer.renderMarkdown(markdown, container, sourcePath, component);
```


## Cross-Platform Support

The plugin only needs to support macos.

## CSS Structure

CSS is modularized in `src/style/` and built into root `styles.css`:

```
src/style/
├── base/           # container, animations (@keyframes)
├── components/     # header, history, messages, code, thinking, toolcalls, todo, subagent, input, ask-user-question, context-footer (meter), plan-banner, plan-approval
├── toolbar/        # model-selector, thinking-selector, permission-toggle, context-path, mcp-selector
├── features/       # file-context, image-context, image-modal, inline-edit, diff, slash-commands
├── modals/         # approval, instruction, mcp-modal
├── settings/       # base, approved-actions, env-snippets, slash-settings, mcp-settings
├── accessibility.css
└── index.css       # Build order (@import list)
```

When adding new CSS modules, register them in `src/style/index.css` via `@import` or the build will omit them.

All classes use `.cortex-` prefix. Key patterns:

| Pattern | Examples |
|---------|----------|
| Layout | `-container`, `-header`, `-messages`, `-input` |
| Messages | `-message`, `-message-user`, `-message-assistant` |
| Tool calls | `-tool-call`, `-tool-header`, `-tool-content`, `-tool-status` |
| Thinking | `-thinking-block`, `-thinking-header`, `-thinking-content` |
| Todo | `-todo-list`, `-todo-item`, `-todo-pending`, `-todo-completed` |
| Subagent | `-subagent-list`, `-subagent-header`, `-subagent-content` |
| File context | `-file-chip`, `-mention-dropdown` |
| Images | `-image-preview`, `-image-chip`, `-drop-overlay` |
| Inline edit | `-inline-input`, `-inline-diff-replace`, `-diff-del`, `-diff-ins` |
| Selection | `-selection-indicator`, `-selection-highlight` |
| Context paths | `-context-path-selector`, `-context-path-icon`, `-context-path-dropdown` |
| Context meter | `-context-meter`, `-context-meter-gauge`, `-context-meter-percent`, `-meter-bg`, `-meter-fill` |
| MCP | `-mcp-selector`, `-mcp-selector-icon`, `-mcp-selector-dropdown`, `-mcp-item` |
| MCP Settings | `-mcp-header`, `-mcp-list`, `-mcp-status`, `-mcp-test-modal` |
| AskUserQuestion | `-ask-panel`, `-ask-question-block`, `-ask-question-tree`, `-ask-question-q`, `-ask-question-a` |
| Plan mode | `-plan-banner`, `-plan-approval-panel`, `-plan-approval-actions`, `-plan-badge` |
| Modals | `-approval-modal`, `-instruction-modal`, `-mcp-modal` |

## Development Notes

- Test Driven Development
- Generated docs go in `dev/`, move docs to `dev/archive` before commit
- Generated agents communication notes in `.agents/`, move notes to `.agents/archive` before commit, do not check in any docs under `.agents/` or `.agents/archive`(already gitignored)
- Run `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run test` after editing
