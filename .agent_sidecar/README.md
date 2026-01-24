# Agent Sidecar Config

## Installed Tools

- **Obsidian** - `/usr/local/bin/obsidian` (extracted AppImage)
- **Playwright** - Browser testing with Chromium

## Network

Firewall allowlist active. 

## Files

| File | Purpose |
|------|---------|
| `sidecar.repo.conf` | Team config (apt packages, mounts) |
| `build-extra.repo.sh` | Extra build-time installs (Obsidian) |
| `firewall-allowlist.*.txt` | Extra firewall allowed domains |
