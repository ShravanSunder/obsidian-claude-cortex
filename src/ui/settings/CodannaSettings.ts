/**
 * Cortex - Codanna Settings Component
 *
 * Component for displaying Codanna semantic search status and installation instructions.
 */

import { setIcon } from 'obsidian';

import { CODANNA_CONFIG } from '../../features/search/SemanticSearchService';
import type CortexPlugin from '../../main';

/** Codanna availability status. */
type CodannaStatus = 'checking' | 'available' | 'unavailable';

/**
 * Component for displaying Codanna semantic search status.
 * Shows installation instructions when Codanna is not available.
 */
export class CodannaSettings {
  private containerEl: HTMLElement;
  private plugin: CortexPlugin;
  private status: CodannaStatus = 'checking';

  /**
   * Create a new CodannaSettings component.
   * @param containerEl - Container element to render into.
   * @param plugin - Plugin instance.
   */
  constructor(containerEl: HTMLElement, plugin: CortexPlugin) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    this.render();
    await this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    this.status = 'checking';
    this.render();

    try {
      // Check if Codanna server is configured and enabled in MCP settings
      const servers = this.plugin.mcpService.getServers();
      const codannaServer = servers.find(
        (s) => s.name.toLowerCase() === CODANNA_CONFIG.serverName.toLowerCase(),
      );

      if (codannaServer && codannaServer.enabled) {
        this.status = 'available';
      } else {
        this.status = 'unavailable';
      }
    } catch {
      this.status = 'unavailable';
    }

    this.render();
  }

  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('cortex-codanna-settings');

    // Status section
    const statusEl = this.containerEl.createDiv({ cls: 'cortex-codanna-status' });
    this.renderStatus(statusEl);

    // Description
    const descEl = this.containerEl.createDiv({ cls: 'cortex-codanna-desc' });
    descEl.createEl('p', {
      text: 'Codanna enables true semantic search using AI embeddings to find notes by meaning, not just keywords.',
    });

    // Installation instructions (only show if unavailable)
    if (this.status === 'unavailable') {
      this.renderInstallation();
    }
  }

  private renderStatus(container: HTMLElement): void {
    const labelEl = container.createSpan({ cls: 'cortex-codanna-status-label' });
    labelEl.setText('Status:');

    const valueEl = container.createSpan({ cls: 'cortex-codanna-status-value' });

    switch (this.status) {
      case 'checking': {
        const iconSpan = valueEl.createSpan({ cls: 'cortex-codanna-status-icon checking' });
        setIcon(iconSpan, 'loader');
        valueEl.createSpan({ text: ' Checking...' });
        break;
      }
      case 'available': {
        const iconSpan = valueEl.createSpan({ cls: 'cortex-codanna-status-icon available' });
        setIcon(iconSpan, 'check-circle');
        valueEl.createSpan({ text: ' Codanna available via MCP' });
        break;
      }
      case 'unavailable': {
        const iconSpan = valueEl.createSpan({ cls: 'cortex-codanna-status-icon unavailable' });
        setIcon(iconSpan, 'alert-circle');
        valueEl.createSpan({ text: ' Codanna not available' });

        // Add refresh button
        const refreshBtn = container.createEl('button', {
          cls: 'cortex-codanna-refresh-btn',
          attr: { 'aria-label': 'Check again' },
        });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.addEventListener('click', () => {
          void this.checkAvailability();
        });
        break;
      }
    }
  }

  private renderInstallation(): void {
    const installEl = this.containerEl.createDiv({ cls: 'cortex-codanna-install' });

    installEl.createEl('h4', { text: 'Installation' });

    const steps = installEl.createEl('ol', { cls: 'cortex-codanna-steps' });

    // Step 1: Install Rust
    const step1 = steps.createEl('li');
    step1.createSpan({ text: 'Install Rust: ' });
    step1.createEl('a', {
      text: CODANNA_CONFIG.rustUrl,
      href: CODANNA_CONFIG.rustUrl,
      attr: { target: '_blank', rel: 'noopener' },
    });

    // Step 2: Install Codanna
    const step2 = steps.createEl('li');
    step2.createSpan({ text: 'Run: ' });
    const codeEl = step2.createEl('code', { cls: 'cortex-codanna-code' });
    codeEl.setText(CODANNA_CONFIG.installCommand);

    // Copy button for install command
    const copyBtn = step2.createEl('button', {
      cls: 'cortex-codanna-copy-btn',
      attr: { 'aria-label': 'Copy command' },
    });
    setIcon(copyBtn, 'copy');
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(CODANNA_CONFIG.installCommand);
      setIcon(copyBtn, 'check');
      setTimeout(() => setIcon(copyBtn, 'copy'), 1500);
    });

    // Step 3: Add MCP server
    const step3 = steps.createEl('li');
    step3.createSpan({ text: 'Add MCP server "codanna" above with:' });
    const configList = step3.createEl('ul', { cls: 'cortex-codanna-config' });
    configList.createEl('li', { text: 'command: codanna' });
    configList.createEl('li', { text: 'args: ["serve", "--watch"]' });

    // Learn more link
    const learnMoreEl = installEl.createDiv({ cls: 'cortex-codanna-learn-more' });
    learnMoreEl.createEl('a', {
      text: 'Learn more on GitHub',
      href: CODANNA_CONFIG.githubUrl,
      attr: { target: '_blank', rel: 'noopener' },
    });
    const externalIcon = learnMoreEl.createSpan({ cls: 'cortex-codanna-external-icon' });
    setIcon(externalIcon, 'external-link');
  }
}
