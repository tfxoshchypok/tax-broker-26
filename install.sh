#!/usr/bin/env bash
set -e

# Installer for pre-built release packages (downloaded from GitHub Releases).
# Run from the directory where you extracted the zip.

DIR="$(cd "$(dirname "$0")" && pwd)"
BINARY="$DIR/tax-broker-26-linux_x64"
ICON_DEST="$HOME/.local/share/icons/tax-broker-26.svg"
DESKTOP_DEST="$HOME/.local/share/applications/tax-broker-26.desktop"

if [ ! -f "$BINARY" ]; then
  echo "❌ Binary not found: $BINARY"
  echo "   Run install.sh from the extracted zip directory."
  exit 1
fi

chmod +x "$BINARY"

echo "▶ Installing icon..."
mkdir -p "$HOME/.local/share/icons"
if [ -f "$DIR/icon.svg" ]; then
  cp "$DIR/icon.svg" "$ICON_DEST"
fi

echo "▶ Installing desktop launcher..."
mkdir -p "$HOME/.local/share/applications"
cat > "$DESKTOP_DEST" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Tax-Broker-26
Comment=Облік клієнтів і звітності
Exec=$BINARY
Icon=$ICON_DEST
Terminal=false
Categories=Office;Finance;
StartupWMClass=tax-broker-26
DESKTOP

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "✅ Готово! Запустіть: $BINARY"
