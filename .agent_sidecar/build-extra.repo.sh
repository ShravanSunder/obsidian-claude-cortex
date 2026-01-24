#!/bin/bash
# =============================================================================
# build-extra.repo.sh - Custom build-time installations for obsidian-cortex
# =============================================================================
# Runs as root at Docker build time with full network access.
# Agent cannot access this script at runtime.
# =============================================================================

set -e

echo "📦 Installing Obsidian (extracted AppImage)..."

OBSIDIAN_VERSION="1.8.9"

# Detect architecture and select appropriate AppImage
ARCH=$(dpkg --print-architecture)
case "$ARCH" in
    amd64)
        OBSIDIAN_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}.AppImage"
        ;;
    arm64)
        OBSIDIAN_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}-arm64.AppImage"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "   Architecture: $ARCH"
echo "   URL: $OBSIDIAN_URL"

# Install squashfs-tools for reliable AppImage extraction
apt-get update && apt-get install -y --no-install-recommends squashfs-tools && apt-get clean && rm -rf /var/lib/apt/lists/*

# Download AppImage
curl -L "$OBSIDIAN_URL" -o /tmp/obsidian.AppImage

# Extract using unsquashfs (AppImage = ELF runtime + SquashFS)
# Find SquashFS magic bytes (hsqs) and extract from there
cd /tmp
OFFSET=$(LC_ALL=C grep -aobF 'hsqs' obsidian.AppImage | head -1 | cut -d: -f1)
echo "   SquashFS offset: $OFFSET"
tail -c +$((OFFSET + 1)) obsidian.AppImage > obsidian.squashfs
unsquashfs -d /opt/obsidian obsidian.squashfs

# Create symlink
ln -s /opt/obsidian/obsidian /usr/local/bin/obsidian

# Cleanup
rm /tmp/obsidian.AppImage /tmp/obsidian.squashfs

echo "✅ Obsidian ${OBSIDIAN_VERSION} installed to /usr/local/bin/obsidian"
